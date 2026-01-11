import { Argv, Computed, Context, Schema, Service, Session } from 'koishi'
import { resolve } from 'path'

import {} from '@koishijs/plugin-help'
import {} from 'koishi-plugin-rate-limit'
import {} from 'koishi-plugin-profile'
import type {} from '@koishijs/plugin-console'

import { MonetaryCore } from './core'
import { RechargeModule, RechargeConfig } from './recharge'

export { MonetaryCore } from './core'
export { EpayCore } from './epay'
export { RechargeModule } from './recharge'

// 声明控制台服务类型
declare module '@koishijs/plugin-console' {
  namespace Console {
    interface Services {
      'nailong-monetary': RechargeConfigData
    }
  }
}

interface RechargeConfigData {
  enabled: boolean
  port: number
  basePath: string
  adminPassword: string
}

declare module 'koishi' {
  interface Context {
    monetary: Monetary
    console: import('@koishijs/plugin-console').Console
  }

  namespace Command {
    interface Config {
      cost?: Computed<number>
      costCurrency?: string
    }
  }

  interface Tables {
    monetary: Tables.Monetary
    nailong_recharge_products: Tables.NailongRechargeProduct
  }

  namespace Tables {
    interface Monetary {
      userId: string
      uid?: number
      currency: string
      value: number
    }

    interface NailongRechargeProduct {
      id: number
      name: string                // 商品名称，如 "积分充值"
      description?: string        // 商品描述
      currency: string            // 充值到哪个货币字段，如 "default"
      creditsPerYuan: number      // 每元兑换多少积分（1元=xxx积分）
      minAmountFen: number        // 最低充值金额（分），最小1分
      maxAmountFen?: number       // 最高充值金额（分，可选）
      enabled: boolean
      order: number               // 排序，越小越靠前
    }
  }
}

// 声明控制台事件
declare module '@koishijs/plugin-console' {
  interface Events {
    'nailong-monetary/orders'(params: any): any
    'nailong-monetary/complete'(params: any): any
    'nailong-monetary/delete'(params: any): any
    'nailong-monetary/products'(): any
    'nailong-monetary/product/save'(params: any): any
    'nailong-monetary/product/delete'(params: any): any
  }
}

class Monetary extends Service {
  static inject = ['database']

  public core: MonetaryCore

  constructor(ctx: Context, public config: Monetary.Config) {
    super(ctx, 'monetary', true)

    // 初始化核心模块
    this.core = new MonetaryCore(ctx)

    // 定义数据表结构
    ctx.model.extend('monetary', {
      userId: 'string',
      uid: { type: 'unsigned', nullable: true },
      currency: 'string',
      value: 'unsigned',
    }, {
      primary: ['userId', 'currency'],
    })

    // 定义商品表
    ctx.model.extend('nailong_recharge_products', {
      id: 'unsigned',
      name: 'string',
      description: { type: 'string', nullable: true },
      currency: { type: 'string', initial: 'default' },
      creditsPerYuan: { type: 'integer', initial: 100 },
      minAmountFen: { type: 'integer', initial: 100 },  // 默认最低1元=100分
      maxAmountFen: { type: 'integer', nullable: true },
      enabled: { type: 'boolean', initial: true },
      order: { type: 'integer', initial: 0 },
    }, {
      autoInc: true,
    })

    // 扩展指令配置 schema
    ctx.schema.extend('command', Schema.intersect([
      Schema.object({
        cost: Schema.computed(Number).default(0).description('usage cost'),
        costCurrency: Schema.string().default('default').description('currency for cost'),
      }),
    ]), 900)

    // 指令执行前扣费
    ctx.before('command/execute', async (argv: Argv<'id'>) => {
      const { session, options, command } = argv

      let isUsage = true
      for (const { name, notUsage } of Object.values(command._options)) {
        if (name in options && notUsage) isUsage = false
      }
      if (!isUsage) return

      const cost = session.resolve(command.config.cost) ?? 0
      if (!cost) return

      const currency = session.resolve(command.config.costCurrency) ?? 'default'

      try {
        await this.cost(session.user.id, cost, currency)

        if (this.config.showBalance) {
          const balance = await this.getBalance(session.user.id, currency)
          await session.send(
            this.config.msgCostSuccess
              .replace('{cost}', cost.toString())
              .replace('{currency}', currency)
              .replace('{balance}', balance.toString())
          )
        }
      } catch {
        const balance = await this.getBalance(session.user.id, currency)
        return this.config.msgInsufficientBalance
          .replace('{cost}', cost.toString())
          .replace('{currency}', currency)
          .replace('{balance}', balance.toString())
      }
    })

    // 扩展帮助信息
    ctx.on('help/command', (output, command, session: Session<'id'>) => {
      const cost = session.resolve(command.config.cost) ?? 0
      if (cost > 0) output.push(`消耗 ${cost} 货币`)
    })

    // 集成 profile 插件
    ctx.using(['profile'], (ctx) => {
      ctx.profile.register(async (session) => {
        const balance = await this.getBalance(session.user.id, 'default')
        return `余额: ${balance}`
      }, ['id'])
    })

    this.registerCommands(ctx)

    // 注册充值模块
    if (config.recharge.enabled) {
      new RechargeModule(ctx, config.recharge, this.core)
    }

    // 注册控制台页面
    ctx.inject(['console'], (ctx) => {
      ctx.console.addEntry({
        dev: resolve(__dirname, '../client/index.ts'),
        prod: resolve(__dirname, '../dist'),
      }, () => ({
        enabled: config.recharge.enabled,
        port: config.recharge.port,
        basePath: config.recharge.basePath,
        baseUrl: config.recharge.baseUrl,
        adminPassword: config.recharge.adminPassword ? '***' : '',
      }))

      // 注册控制台 API
      this.registerConsoleApi(ctx)
    })
  }

  private registerCommands(ctx: Context) {
    // 查询余额
    ctx.command('monetary.balance', '查询货币余额')
      .alias('余额')
      .alias('balance')
      .userFields(['id'])
      .option('currency', '-c <currency:string> 货币类型', { fallback: 'default' })
      .action(async ({ session, options }) => {
        if (!session?.user?.id) return '无法获取用户信息'

        const balance = await this.getBalance(session.user.id, options.currency)
        return `你的 ${options.currency} 余额: ${balance}`
      })

    // 转账
    ctx.command('monetary.transfer [target:user] [amount:posint]', '向其他用户转账')
      .alias('转账')
      .userFields(['id', 'name'])
      .option('currency', '-c <currency:string> 货币类型', { fallback: 'default' })
      .action(async ({ session, options }, target, amount) => {
        if (!session?.user?.id) return '无法获取用户信息'

        const currency = options.currency
        const fromUid = session.user.id

        const balance = await this.getBalance(fromUid, currency)

        if (!target) {
          await session.send(
            `转账功能\n你的 ${currency} 余额: ${balance}\n\n请@ 目标用户，或输入"取消"来取消转账`
          )

          const nextMessage = await new Promise<Session>((resolve) => {
            const dispose = ctx.middleware((session2, next) => {
              if (session2.userId === session.userId && session2.channelId === session.channelId) {
                dispose()
                resolve(session2)
                return
              }
              return next()
            }, true)

            setTimeout(() => {
              dispose()
              resolve(null)
            }, 60000)
          })

          if (!nextMessage) return '操作超时已取消'

          const content = nextMessage.content.trim()
          if (content === '取消' || content === 'cancel') {
            return '已取消转账'
          }

          const atSegment = nextMessage.elements.find(el => el.type === 'at')
          if (!atSegment?.attrs?.id) {
            return '请使用@ 来指定目标用户'
          }

          target = atSegment.attrs.id
        }

        const toUid = await this.resolveTargetUid(target, session.platform)
        if (!toUid) {
          return '找不到目标用户，对方可能还没有与机器人交互过'
        }

        if (fromUid === toUid) {
          return '不能给自己转账'
        }

        const targetName = await this.core.getUserDisplayName(toUid) ?? `用户${toUid}`

        if (!amount) {
          await session.send(
            `转账给: ${targetName}\n你的余额: ${balance} ${currency}\n\n请输入转账金额，或输入"取消"来取消转账`
          )

          const input = await session.prompt(60000)
          if (!input) return '操作超时已取消'

          const trimmed = input.trim()
          if (trimmed === '取消' || trimmed === 'cancel') {
            return '已取消转账'
          }

          amount = parseInt(trimmed)
          if (isNaN(amount) || amount <= 0) {
            return '请输入有效的正整数金额'
          }
        }

        if (amount <= 0) return '转账金额必须大于0'
        if (balance < amount) {
          return `余额不足\n当前余额: ${balance} ${currency}\n需要: ${amount} ${currency}`
        }

        await session.send(
          `转账确认\n目标: ${targetName}\n金额: ${amount} ${currency}\n\n请在30秒内输入"确认"来完成转账`
        )

        const confirm = await session.prompt(30000)
        if (!confirm) return '操作超时已取消'

        const confirmText = confirm.trim().toLowerCase()
        if (!['确认', 'confirm', 'yes', 'y'].includes(confirmText)) {
          return '已取消转账'
        }

        try {
          await this.transfer(fromUid, toUid, amount, currency)
          const newBalance = await this.getBalance(fromUid, currency)
          return `转账成功！\n已向 ${targetName} 转账 ${amount} ${currency}\n当前余额: ${newBalance} ${currency}`
        } catch (error) {
          return `转账失败: ${error.message}`
        }
      })

    // 管理员指令：修复 uid
    ctx.command('monetary.fix-uid', '修复缺失的uid字段', { authority: 4 })
      .option('currency', '-c <currency:string> 仅处理指定货币类型')
      .option('limit', '-l <limit:posint> 单次处理上限', { fallback: 100 })
      .action(async ({ options }) => {
        const { currency, limit } = options

        const query: any = {}
        if (currency) query.currency = currency

        const allRecords = await this.ctx.database.get('monetary', query, ['userId', 'currency', 'uid'])
        const records = allRecords.filter(r => !r.uid)

        if (records.length === 0) {
          return '没有需要修复的记录'
        }

        let successCount = 0
        let failCount = 0
        const processLimit = Math.min(records.length, limit)

        for (let i = 0; i < processLimit; i++) {
          const record = records[i]
          const uid = await this.core.getUidByPid(record.userId)

          if (uid) {
            await this.ctx.database.set(
              'monetary',
              { userId: record.userId, currency: record.currency },
              { uid }
            )
            successCount++
          } else {
            failCount++
          }
        }

        const remaining = records.length - processLimit
        let result = `修复完成\n成功: ${successCount}\n失败: ${failCount}`
        if (remaining > 0) {
          result += `\n剩余: ${remaining} 条`
        }
        return result
      })
  }

  // ============ 辅助方法 ============

  private async resolveTargetUid(target: string, platform: string): Promise<number | null> {
    if (target.includes(':')) {
      const idx = target.indexOf(':')
      const targetPlatform = target.slice(0, idx)
      const pid = target.slice(idx + 1)

      const user = await this.ctx.database.getUser(targetPlatform, pid, ['id'])
      return user?.id ?? null
    }

    const user = await this.ctx.database.getUser(platform, target, ['id'])
    return user?.id ?? null
  }

  // ============ 公开 API（代理到 core）============

  async getBalance(uid: number, currency: string = 'default'): Promise<number> {
    return this.core.getBalance(uid, currency)
  }

  async gain(uid: number, amount: number, currency: string = 'default'): Promise<void> {
    return this.core.gain(uid, amount, currency)
  }

  async cost(uid: number, amount: number, currency: string = 'default'): Promise<void> {
    return this.core.cost(uid, amount, currency)
  }

  async transfer(fromUid: number, toUid: number, amount: number, currency: string = 'default'): Promise<void> {
    return this.core.transfer(fromUid, toUid, amount, currency)
  }

  // ============ 控制台 API ============

  private registerConsoleApi(ctx: Context) {
    // 获取订单列表
    ctx.console.addListener('nailong-monetary/orders', async (params: {
      page: number
      pageSize: number
      userId?: string
      status?: string
      startDate?: string
      endDate?: string
    }) => {
      const { page = 1, pageSize = 20, userId, status, startDate, endDate } = params

      const query: any = {}
      if (status && status !== 'all') query.status = status
      if (userId) query.userId = { $regex: userId }

      let orders = await ctx.database.get('nailong_recharge_orders', query, {
        sort: { createdAt: 'desc' },
      })

      // 日期过滤
      if (startDate) {
        const start = new Date(startDate)
        orders = orders.filter(o => new Date(o.createdAt) >= start)
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        orders = orders.filter(o => new Date(o.createdAt) <= end)
      }

      const total = orders.length
      const paginatedOrders = orders.slice((page - 1) * pageSize, page * pageSize)

      // 统计
      const stats = {
        totalAmount: orders.filter(o => o.status === 'success').reduce((sum, o) => sum + o.amount, 0),
        totalCredits: orders.filter(o => o.status === 'success').reduce((sum, o) => sum + o.credits, 0),
        successCount: orders.filter(o => o.status === 'success').length,
        pendingCount: orders.filter(o => o.status === 'pending').length,
        failedCount: orders.filter(o => o.status === 'failed').length,
      }

      return { orders: paginatedOrders, total, page, pageSize, stats }
    })

    // 手动补单
    ctx.console.addListener('nailong-monetary/complete', async (params: { outTradeNo: string }) => {
      const { outTradeNo } = params
      if (!outTradeNo) throw new Error('订单号不能为空')

      const [order] = await ctx.database.get('nailong_recharge_orders', { outTradeNo })
      if (!order) throw new Error('订单不存在')
      if (order.status === 'success') throw new Error('订单已完成')

      // 更新订单状态
      await ctx.database.set('nailong_recharge_orders', { outTradeNo }, {
        status: 'success',
        updatedAt: new Date(),
      })

      // 增加用户积分，使用订单保存的 currency
      await this.core.gainByUserId(order.userId, order.credits, order.currency || 'default')

      ctx.logger.info(`[控制台补单] 用户 ${order.userId} 充值成功: ${order.amount}元 = ${order.credits} ${order.currency || 'default'} 积分`)
      return { success: true }
    })

    // 删除订单
    ctx.console.addListener('nailong-monetary/delete', async (params: { outTradeNo: string }) => {
      const { outTradeNo } = params
      if (!outTradeNo) throw new Error('订单号不能为空')

      await ctx.database.remove('nailong_recharge_orders', { outTradeNo })
      return { success: true }
    })

    // 获取商品列表
    ctx.console.addListener('nailong-monetary/products', async () => {
      const products = await ctx.database.get('nailong_recharge_products', {}, {
        sort: { order: 'asc' },
      })
      return { products }
    })

    // 添加/更新商品
    ctx.console.addListener('nailong-monetary/product/save', async (params: {
      id?: number
      name: string
      description?: string
      currency: string
      creditsPerYuan: number
      minAmountFen: number
      maxAmountFen?: number
      enabled: boolean
      order: number
    }) => {
      const { id, name, description, currency, creditsPerYuan, minAmountFen, maxAmountFen, enabled, order } = params

      if (!name || !currency || creditsPerYuan <= 0 || minAmountFen < 1) {
        throw new Error('参数无效：商品名称、货币类型必填，转化比例必须大于0，最低金额至少1分')
      }

      if (id) {
        // 更新
        await ctx.database.set('nailong_recharge_products', { id }, {
          name, description, currency, creditsPerYuan, minAmountFen, maxAmountFen, enabled, order,
        })
      } else {
        // 创建
        await ctx.database.create('nailong_recharge_products', {
          name, description, currency, creditsPerYuan, minAmountFen, maxAmountFen, enabled, order,
        })
      }
      return { success: true }
    })

    // 删除商品
    ctx.console.addListener('nailong-monetary/product/delete', async (params: { id: number }) => {
      const { id } = params
      if (!id) throw new Error('商品ID不能为空')

      await ctx.database.remove('nailong_recharge_products', { id })
      return { success: true }
    })
  }
}

namespace Monetary {
  export interface Config {
    msgCostSuccess: string
    msgInsufficientBalance: string
    showBalance: boolean
    recharge: RechargeConfig
  }

  export const Config: Schema<Config> = Schema.intersect([
    Schema.object({
      msgCostSuccess: Schema.string()
        .description('扣费成功消息 - 变量: {cost}, {currency}, {balance}')
        .default('已扣除 {cost} {currency}，当前余额: {balance}')
        .role('textarea', { rows: [2, 4] }),
      msgInsufficientBalance: Schema.string()
        .description('余额不足消息 - 变量: {cost}, {currency}, {balance}')
        .default('余额不足，需要 {cost} {currency}，当前余额: {balance}')
        .role('textarea', { rows: [2, 4] }),
      showBalance: Schema.boolean()
        .description('扣费时显示余额')
        .default(true),
    }).description('基础配置'),

    Schema.object({
      recharge: Schema.object({
        enabled: Schema.boolean()
          .description('启用充值功能')
          .default(false),
        port: Schema.number()
          .description('充值服务独立端口')
          .default(8211),
        basePath: Schema.string()
          .description('充值页面路径前缀')
          .default('/recharge'),
        baseUrl: Schema.string()
          .description('外部访问的基础 URL')
          .default('http://localhost:8211'),
        apiUrl: Schema.string()
          .description('支付平台 API 地址，挂个AFF:https://epay.wxda.net/user/?invite=A0IGDg')
          .default('https://epayapi.wxda.net/'),
        pid: Schema.string()
          .description('商户 ID')
          .default(''),
        platformPublicKey: Schema.string()
          .description('平台公钥')
          .default('')
          .role('textarea', { rows: [4, 8] }),
        merchantPrivateKey: Schema.string()
          .description('商户私钥')
          .default('')
          .role('textarea', { rows: [4, 8] }),
        notifyUrl: Schema.string()
          .description('异步通知地址（留空自动生成）')
          .default(''),
        returnUrl: Schema.string()
          .description('同步返回地址（留空自动生成）')
          .default(''),
        creditsPerYuan: Schema.number()
          .description('每元兑换积分数')
          .default(900),
        adminPassword: Schema.string()
          .description('管理后台密码（留空则不开放管理后台）')
          .default('')
          .role('secret'),
      }).description('充值配置'),
    }),
  ])
}

export default Monetary
