import { Context } from 'koishi'
import { EpayCore } from './epay'
import { MonetaryCore } from './core'
import {
  renderIndexPage,
  renderSuccessPage,
  renderErrorPage,
  renderQueryPage,
  renderAdminLoginPage,
  renderAdminPage,
  ProductInfo
} from './templates'
import Koa from 'koa'
import Router from '@koa/router'
import { koaBody } from 'koa-body'
import { Server } from 'http'

export interface RechargeConfig {
  enabled: boolean
  port: number
  basePath: string
  baseUrl: string
  apiUrl: string
  pid: string
  platformPublicKey: string
  merchantPrivateKey: string
  notifyUrl: string
  returnUrl: string
  creditsPerYuan: number    // 保留作为默认值（如果没有商品时使用）
  adminPassword: string
}

declare module 'koishi' {
  interface Tables {
    nailong_recharge_orders: Tables.NailongRechargeOrder
  }

  namespace Tables {
    interface NailongRechargeOrder {
      outTradeNo: string
      userId: string
      uid?: number
      productId?: number      // 关联商品ID
      currency: string        // 充值的货币类型
      amount: number
      credits: number
      payType: string
      status: 'pending' | 'success' | 'failed'
      createdAt: Date
      updatedAt: Date
    }
  }
}

/**
 * 充值模块 - 独立端口
 */
export class RechargeModule {
  private epay: EpayCore
  private monetaryCore: MonetaryCore
  private app: Koa
  private server: Server
  // 简单的 session 存储
  private adminSessions: Map<string, number> = new Map()

  constructor(
    private ctx: Context,
    private config: RechargeConfig,
    monetaryCore: MonetaryCore
  ) {
    this.monetaryCore = monetaryCore

    // 定义充值订单表
    ctx.model.extend('nailong_recharge_orders', {
      outTradeNo: 'string',
      userId: 'string',
      uid: { type: 'unsigned', nullable: true },
      productId: { type: 'unsigned', nullable: true },
      currency: { type: 'string', initial: 'default' },
      amount: 'double',
      credits: 'integer',
      payType: 'string',
      status: 'string',
      createdAt: 'timestamp',
      updatedAt: 'timestamp',
    }, {
      primary: 'outTradeNo',
    })

    // 初始化 Epay
    this.epay = new EpayCore({
      apiUrl: config.apiUrl,
      pid: config.pid,
      platformPublicKey: config.platformPublicKey,
      merchantPrivateKey: config.merchantPrivateKey,
    })

    // 创建独立的 Koa 服务器
    this.app = new Koa()
    this.setupServer()

    // 插件停用时关闭服务器
    ctx.on('dispose', () => {
      if (this.server) {
        this.server.close()
        ctx.logger.info('充值服务器已关闭')
      }
    })
  }

  private generateSessionId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36)
  }

  private isValidSession(sessionId: string): boolean {
    const expiry = this.adminSessions.get(sessionId)
    if (!expiry) return false
    if (Date.now() > expiry) {
      this.adminSessions.delete(sessionId)
      return false
    }
    return true
  }

  private getSessionFromCookie(cookieHeader: string | undefined): string | null {
    if (!cookieHeader) return null
    const match = cookieHeader.match(/admin_session=([^;]+)/)
    return match ? match[1] : null
  }

  private setupServer() {
    const { config, ctx } = this
    const basePath = config.basePath || '/recharge'
    const router = new Router()

    // 使用 body 解析中间件
    this.app.use(koaBody())

    // ============ 用户页面 ============

    // 根路径重定向到充值页面
    if (basePath !== '/') {
      router.get('/', (koa) => {
        koa.redirect(basePath)
      })
    }

    // 首页 - 动态加载商品列表
    router.get(basePath, async (koa) => {
      // 获取启用的商品列表
      const products = await ctx.database.get('nailong_recharge_products', { enabled: true }, {
        sort: { order: 'asc' },
      })

      // 转换为模板需要的格式
      const productInfos: ProductInfo[] = products.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        currency: p.currency,
        creditsPerYuan: p.creditsPerYuan,
        minAmountFen: p.minAmountFen,
        maxAmountFen: p.maxAmountFen,
      }))

      koa.type = 'html'
      koa.body = renderIndexPage({
        basePath,
        products: productInfos,
      })
    })

    // 支付请求
    router.post(`${basePath}/pay`, async (koa) => {
      try {
        const body = (koa.request as any).body || {}
        const qqNumber = body.qq || body.userId
        const moneyStr = body.money || body.amount
        const payType = body.type || body.pay_type || 'alipay'
        const productIdStr = body.productId
        const name = body.name || '积分充值'

        if (!qqNumber || !moneyStr) {
          koa.status = 400
          koa.type = 'html'
          koa.body = renderErrorPage('参数不完整，请检查表单数据', basePath)
          return
        }

        const amount = parseFloat(moneyStr)
        if (isNaN(amount) || amount < 0.01) {
          koa.status = 400
          koa.type = 'html'
          koa.body = renderErrorPage('金额无效', basePath)
          return
        }

        const amountFen = Math.round(amount * 100)

        // 获取商品信息
        let creditsPerYuan = config.creditsPerYuan  // 默认值
        let currency = 'default'
        let productId: number | undefined

        if (productIdStr) {
          const [product] = await ctx.database.get('nailong_recharge_products', { id: parseInt(productIdStr) })
          if (product && product.enabled) {
            // 验证金额范围
            if (amountFen < product.minAmountFen) {
              koa.status = 400
              koa.type = 'html'
              koa.body = renderErrorPage(`充值金额不能低于 ${product.minAmountFen / 100} 元`, basePath)
              return
            }
            if (product.maxAmountFen && amountFen > product.maxAmountFen) {
              koa.status = 400
              koa.type = 'html'
              koa.body = renderErrorPage(`充值金额不能超过 ${product.maxAmountFen / 100} 元`, basePath)
              return
            }

            creditsPerYuan = product.creditsPerYuan
            currency = product.currency
            productId = product.id
          }
        }

        // 获取或创建用户的 uid（如果用户不存在会自动创建 onebot 平台用户）
        const uid = await this.monetaryCore.getOrCreateUidByPid(qqNumber)

        const credits = Math.floor(amount * creditsPerYuan)
        const outTradeNo = `NL${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`

        // 创建订单
        await ctx.database.create('nailong_recharge_orders', {
          outTradeNo,
          userId: qqNumber,
          uid,
          productId,
          currency,
          amount,
          credits,
          payType,
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        // 生成支付表单
        const payHtml = this.epay.buildPayForm({
          type: payType,
          outTradeNo,
          name,
          money: moneyStr,
          notifyUrl: config.notifyUrl || `${config.baseUrl}${basePath}/notify`,
          returnUrl: config.returnUrl || `${config.baseUrl}${basePath}/return`,
        })

        koa.type = 'html'
        koa.body = payHtml
      } catch (error) {
        ctx.logger.error('创建支付订单失败:', error)
        koa.status = 500
        koa.type = 'html'
        koa.body = renderErrorPage('系统错误，请稍后重试', basePath)
      }
    })

    // 异步通知回调
    router.all(`${basePath}/notify`, async (koa) => {
      try {
        const params = { ...koa.query, ...((koa.request as any).body || {}) } as Record<string, string>
        ctx.logger.info('收到支付回调:', params)

        if (!this.epay.verifySign(params)) {
          ctx.logger.warn('签名验证失败')
          koa.body = 'fail'
          return
        }

        if (params.trade_status !== 'TRADE_SUCCESS') {
          ctx.logger.warn('交易状态非成功:', params.trade_status)
          koa.body = 'fail'
          return
        }

        await this.processSuccessfulPayment(params.out_trade_no)
        koa.body = 'success'
      } catch (error) {
        ctx.logger.error('处理支付回调失败:', error)
        koa.body = 'fail'
      }
    })

    // 同步返回页面
    router.get(`${basePath}/return`, async (koa) => {
      const params = koa.query as Record<string, string>
      const verified = this.epay.verifySign(params)
      const success = verified && params.trade_status === 'TRADE_SUCCESS'

      koa.type = 'html'
      if (success) {
        // 获取订单信息以显示正确的积分数
        const [order] = await ctx.database.get('nailong_recharge_orders', { outTradeNo: params.out_trade_no })
        const credits = order?.credits ?? 0
        koa.body = renderSuccessPage(params.out_trade_no, params.money, credits, basePath)
      } else {
        koa.body = renderErrorPage('支付失败或签名验证失败', basePath)
      }
    })

    // 查询页面
    router.get(`${basePath}/query`, async (koa) => {
      koa.type = 'html'
      koa.body = renderQueryPage(basePath)
    })

    // 查询 API
    router.get(`${basePath}/api/query`, async (koa) => {
      const userId = (koa.query.userId || koa.query.qq) as string

      if (!userId) {
        koa.body = { error: '请输入用户ID' }
        return
      }

      const orders = await ctx.database.get('nailong_recharge_orders', { userId }, {
        sort: { createdAt: 'desc' },
        limit: 10,
      })

      const credits = await this.monetaryCore.getBalanceByUserId(userId)

      koa.body = { userId, credits, orders }
    })

    // ============ 管理后台（仅当设置了密码时开放）============

    if (config.adminPassword) {
      ctx.logger.info('管理后台已启用')

      // 管理登录页
      router.get(`${basePath}/admin`, async (koa) => {
        const sessionId = this.getSessionFromCookie(koa.headers.cookie)
        if (sessionId && this.isValidSession(sessionId)) {
          koa.type = 'html'
          koa.body = renderAdminPage(basePath)
        } else {
          koa.type = 'html'
          koa.body = renderAdminLoginPage(basePath)
        }
      })

      // 管理登录处理
      router.post(`${basePath}/admin/login`, async (koa) => {
        const body = (koa.request as any).body || {}
        const password = body.password

        if (password === config.adminPassword) {
          const sessionId = this.generateSessionId()
          this.adminSessions.set(sessionId, Date.now() + 24 * 60 * 60 * 1000)
          koa.set('Set-Cookie', `admin_session=${sessionId}; Path=${basePath}; HttpOnly; Max-Age=86400`)
          koa.body = { success: true }
        } else {
          koa.status = 401
          koa.body = { error: '密码错误' }
        }
      })

      // 管理登出
      router.get(`${basePath}/admin/logout`, async (koa) => {
        const sessionId = this.getSessionFromCookie(koa.headers.cookie)
        if (sessionId) {
          this.adminSessions.delete(sessionId)
        }
        koa.set('Set-Cookie', `admin_session=; Path=${basePath}; HttpOnly; Max-Age=0`)
        koa.redirect(`${basePath}/admin`)
      })

      // 管理 API - 获取订单列表
      router.get(`${basePath}/admin/api/orders`, async (koa) => {
        const sessionId = this.getSessionFromCookie(koa.headers.cookie)
        if (!sessionId || !this.isValidSession(sessionId)) {
          koa.status = 401
          koa.body = { error: '未登录' }
          return
        }

        const { page = '1', pageSize = '20', status, userId, startDate, endDate } = koa.query as Record<string, string>

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
        const pageNum = parseInt(page)
        const size = parseInt(pageSize)
        const paginatedOrders = orders.slice((pageNum - 1) * size, pageNum * size)

        // 统计
        const stats = {
          totalAmount: orders.filter(o => o.status === 'success').reduce((sum, o) => sum + o.amount, 0),
          totalCredits: orders.filter(o => o.status === 'success').reduce((sum, o) => sum + o.credits, 0),
          successCount: orders.filter(o => o.status === 'success').length,
          pendingCount: orders.filter(o => o.status === 'pending').length,
          failedCount: orders.filter(o => o.status === 'failed').length,
        }

        koa.body = { orders: paginatedOrders, total, page: pageNum, pageSize: size, stats }
      })

      // 管理 API - 手动补单
      router.post(`${basePath}/admin/api/complete`, async (koa) => {
        const sessionId = this.getSessionFromCookie(koa.headers.cookie)
        if (!sessionId || !this.isValidSession(sessionId)) {
          koa.status = 401
          koa.body = { error: '未登录' }
          return
        }

        const body = (koa.request as any).body || {}
        const { outTradeNo } = body

        if (!outTradeNo) {
          koa.status = 400
          koa.body = { error: '订单号不能为空' }
          return
        }

        try {
          await this.processSuccessfulPayment(outTradeNo)
          koa.body = { success: true }
        } catch (error) {
          koa.status = 400
          koa.body = { error: error.message }
        }
      })

      // 管理 API - 删除订单
      router.post(`${basePath}/admin/api/delete`, async (koa) => {
        const sessionId = this.getSessionFromCookie(koa.headers.cookie)
        if (!sessionId || !this.isValidSession(sessionId)) {
          koa.status = 401
          koa.body = { error: '未登录' }
          return
        }

        const body = (koa.request as any).body || {}
        const { outTradeNo } = body

        if (!outTradeNo) {
          koa.status = 400
          koa.body = { error: '订单号不能为空' }
          return
        }

        await ctx.database.remove('nailong_recharge_orders', { outTradeNo })
        koa.body = { success: true }
      })
    }

    // 注册路由
    this.app.use(router.routes())
    this.app.use(router.allowedMethods())

    // 启动服务器
    const port = config.port || 8211
    this.server = this.app.listen(port, () => {
      ctx.logger.info(`充值服务器已启动: http://localhost:${port}${basePath}`)
    })
  }

  /**
   * 处理成功的支付
   */
  private async processSuccessfulPayment(outTradeNo: string): Promise<void> {
    const [order] = await this.ctx.database.get('nailong_recharge_orders', { outTradeNo })

    if (!order) {
      throw new Error('订单不存在')
    }

    if (order.status === 'success') {
      return // 已处理过
    }

    // 更新订单状态
    await this.ctx.database.set('nailong_recharge_orders', { outTradeNo }, {
      status: 'success',
      updatedAt: new Date(),
    })

    // 增加用户积分，使用订单保存的 currency
    await this.monetaryCore.gainByUserId(order.userId, order.credits, order.currency || 'default')

    this.ctx.logger.info(`用户 ${order.userId} 充值成功: ${order.amount}元 = ${order.credits} ${order.currency || 'default'} 积分`)
  }
}
