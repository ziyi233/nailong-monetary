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

      } catch (e) {

        return '你没有足够的点数。'

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

}


namespace Monetary {

  export interface Config {}


  export const Config: Schema<Config> = Schema.object({})

}


export default Monetary