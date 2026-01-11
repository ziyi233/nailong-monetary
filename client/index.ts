import { Context, icons } from '@koishijs/client'
import Page from './page.vue'
import MoneyIcon from './icons/money.vue'

icons.register('activity:money', MoneyIcon)

export default (ctx: Context) => {
  ctx.page({
    name: '积分充值管理',
    path: '/nailong-monetary',
    component: Page,
    icon: 'activity:money',
    order: 500,
  })
}
