import { $, Argv, Computed, Context, Schema, Service, Session } from 'koishi'

import {} from '@koishijs/plugin-help'

import {} from 'koishi-plugin-rate-limit'

import {} from 'koishi-plugin-profile'


declare module 'koishi' {

  interface Context {

    monetary: Monetary

  }


  namespace Command {

    interface Config {

      cost?: Computed<number>

      costCurrency?: string

    }

  }


  interface Tables {

    monetary: Tables.Monetary

  }


  namespace Tables {

    interface Monetary {

      userId : string

      currency: string

      value: number

    }

  }

}


class Monetary extends Service {

  static inject = ['database']


  constructor(ctx: Context, config: Monetary.Config) {

    super(ctx, 'monetary', true)


    ctx.model.extend('monetary', {

      userId: 'string',

      currency: 'string',

      value: 'unsigned',

    }, {

      primary: ['userId', 'currency'],

    })


    ctx.schema.extend('command', Schema.intersect([
      Schema.object({
        cost: Schema.computed(Number).default(0).description('每次调用的花费。'),
        costCurrency: Schema.string().default('default').description('花费的货币名。'),
      }),
    ]), 900)

    ctx.before('command/execute', async (argv: Argv<'id'>) => {

      const { session, options, command } = argv

      let isUsage = true

      for (const { name, notUsage } of Object.values(command._options)) {

        if (name in options && notUsage) isUsage = false

      }

      if (!isUsage) return

      const cost = session.resolve(command.config.cost) ?? 0

      if (!cost) return

      const costCurrency = session.resolve(command.config.costCurrency) ?? 'default'

      try {

        await this.cost(session.userId, cost, costCurrency)

        // 扣费成功后显示消息

        if (config.showBalance) {

          const balance = await this.getBalance(session.userId, costCurrency)

          const message = config.msgCostSuccess

            .replace('{cost}', cost.toString())

            .replace('{currency}', costCurrency)

            .replace('{balance}', balance.toString())

          await session.send(message)

        }

      } catch (e) {

        // 余额不足

        const balance = await this.getBalance(session.userId, costCurrency)

        const message = config.msgInsufficientBalance

          .replace('{cost}', cost.toString())

          .replace('{currency}', costCurrency)

          .replace('{balance}', balance.toString())

        return message

      }

    })


    // extend command help

    ctx.on('help/command', (output, command, session: Session<'id'>) => {

      const cost = session.resolve(command.config.cost) ?? 0

      if (cost > 0) output.push(`花费：${cost} 点数`)

    })


    ctx.using(['profile'], (ctx) => {

      ctx.profile.register(async (session) => {

        const [data] = await this.ctx.database.get('monetary', {

          userId : session.userId ,

          currency: 'default',

        }, ['value'])

        return `点数：${data?.value ?? 0}`

      }, ['id'])

    })


    // 转账指令

    ctx.command('monetary.transfer [target:user] [amount:posint]', '转账点数给其他用户')

      .alias('转账')

      .userFields(['id', 'name'])

      .option('currency', '-c <currency:string> 货币类型', { fallback: 'default' })

      .action(async ({ session, options }, target, amount) => {

        if (!session?.userId) return '无法获取用户信息'


        const currency = options.currency

        const fromUserId = session.userId


        // 显示当前余额

        const balance = await this.getBalance(fromUserId, currency)


        // 交互式输入：如果没有提供目标用户

        if (!target) {

          await session.send(`【转账】\n当前 ${currency} 余额：${balance}\n\n请 @ 提及要转账的目标用户（60秒内有效，发送"取消"可中止）`)


          // 使用一次性中间件来捕获包含 @ 的消息

          const nextMessage = await new Promise<Session>((resolve) => {

            const dispose = ctx.middleware((session2, next) => {

              if (session2.userId === session.userId && session2.channelId === session.channelId) {

                dispose()

                resolve(session2)

                return // 不继续传递，避免触发其他指令

              }

              return next()

            }, true)


            // 设置超时

            setTimeout(() => {

              dispose()

              resolve(null)

            }, 60000)

          })


          if (!nextMessage) {

            return '转账超时，已取消'

          }


          if (nextMessage.content.trim() === '取消' || nextMessage.content.trim() === 'cancel') {

            return '已取消转账'

          }


          // 解析 @ 提及

          const atSegment = nextMessage.elements.find(el => el.type === 'at')

          if (!atSegment || !atSegment.attrs?.id) {

            return '❌ 请使用 @ 提及目标用户，而不是直接输入用户ID'

          }


          target = atSegment.attrs.id

        }


        // 检查是否转账给自己

        if (fromUserId === target) {

          return '❌ 不能转账给自己'

        }


        const toUserId = target


        // 获取目标用户信息（如果不存在也没关系，转账时会自动创建货币记录）

        const [targetUser] = await ctx.database.get('user', toUserId, ['id', 'name'])

        const targetName = targetUser?.name || toUserId


        // 交互式输入：如果没有提供金额

        if (!amount) {

          await session.send(`转账给：${targetName} (${toUserId})\n当前余额：${balance} ${currency}\n\n请输入转账金额（必须为正整数，60秒内有效，发送"取消"可中止）：`)

          const amountInput = await session.prompt(60000)


          if (!amountInput) {

            return '转账超时，已取消'

          }


          if (amountInput.trim() === '取消' || amountInput.trim() === 'cancel') {

            return '已取消转账'

          }


          const parsedAmount = parseInt(amountInput.trim())

          if (isNaN(parsedAmount) || parsedAmount <= 0) {

            return '❌ 金额无效，必须为正整数'

          }


          amount = parsedAmount

        }


        // 验证金额

        if (amount <= 0) {

          return '❌ 转账金额必须大于0'

        }


        try {

          // 检查余额

          if (balance < amount) {

            return `❌ 余额不足\n当前余额：${balance} ${currency}\n需要金额：${amount} ${currency}`

          }


          // 二次确认

          await session.send(`【确认转账】\n转账给：${targetName} (${toUserId})\n转账金额：${amount} ${currency}\n当前余额：${balance} ${currency}\n转账后余额：${balance - amount} ${currency}\n\n⚠️ 请在30秒内回复"确认"继续，或回复"取消"中止`)


          const confirm = await session.prompt(30000)


          if (!confirm) {

            return '转账超时，已取消'

          }


          const confirmText = confirm.trim()

          if (confirmText !== '确认' && confirmText !== 'confirm' && confirmText !== 'yes' && confirmText !== 'y') {

            return '已取消转账'

          }


          // 再次验证用户身份（防止会话劫持）

          if (session.userId !== fromUserId) {

            return '❌ 用户身份验证失败，转账已取消'

          }


          // 执行转账

          await this.transfer(fromUserId, toUserId, amount, currency)


          const newBalance = await this.getBalance(fromUserId, currency)

          return `✅ 转账成功！\n已向 ${targetName} 转账 ${amount} ${currency}\n当前余额：${newBalance} ${currency}`


        } catch (error) {

          return `❌ 转账失败：${error.message}`

        }

      })


    // 查询余额指令

    ctx.command('monetary.balance', '查询点数余额')

      .alias('余额')

      .alias('balance')

      .userFields(['id'])

      .option('currency', '-c <currency:string> 货币类型', { fallback: 'default' })

      .action(async ({ session, options }) => {

        if (!session?.userId) return '无法获取用户信息'


        const currency = options.currency

        const balance = await this.getBalance(session.userId, currency)


        return `你的 ${currency} 余额：${balance}`

      })

  }


  async cost(userId: string, cost: number = 0, currency: string = 'default') {

    const [data] = await this.ctx.database.get('monetary', {

      userId,

      currency,

    }, ['value'])

    if (!data) throw new Error('insufficient balance.')

    if (data.value < cost) throw new Error('insufficient balance.')

    await this.ctx.database.set('monetary', {

      userId,

      currency,

    }, (row) => ({

      value: $.sub(row.value, cost),

    }))

  }


  async gain(userId: string, gain: number, currency: string = 'default') {

    await this.ctx.database.upsert('monetary', (row) => [{

      userId,

      currency,

      value: $.add(row.value, gain),

    }])

  }


  async transfer(fromUserId: string, toUserId: string, amount: number, currency: string = 'default') {

    if (amount <= 0) throw new Error('转账金额必须大于0')

    if (fromUserId === toUserId) throw new Error('不能转账给自己')


    // 检查发送者余额

    const [fromData] = await this.ctx.database.get('monetary', {

      userId: fromUserId,

      currency,

    }, ['value'])


    if (!fromData || fromData.value < amount) {

      throw new Error('余额不足')

    }


    // 执行转账（gain 方法使用 upsert，会自动为目标用户创建货币记录）

    await this.cost(fromUserId, amount, currency)

    await this.gain(toUserId, amount, currency)

  }


  async getBalance(userId: string, currency: string = 'default'): Promise<number> {

    const [data] = await this.ctx.database.get('monetary', {

      userId,

      currency,

    }, ['value'])


    return data?.value ?? 0

  }

}


namespace Monetary {

  export interface Config {

    msgCostSuccess: string

    msgInsufficientBalance: string

    showBalance: boolean

  }


  export const Config: Schema<Config> = Schema.object({

    msgCostSuccess: Schema.string()

      .description('扣费成功消息 - 变量: {cost}, {currency}, {balance}')

      .default('💰 已扣除 {cost} {currency}，当前余额：{balance}')

      .role('textarea', { rows: [2, 4] }),

    msgInsufficientBalance: Schema.string()

      .description('余额不足消息 - 变量: {cost}, {currency}, {balance}')

      .default('❌ 余额不足！需要 {cost} {currency}，当前余额：{balance}')

      .role('textarea', { rows: [2, 4] }),

    showBalance: Schema.boolean()

      .description('扣费后是否显示余额')

      .default(true),

  })

}


export default Monetary