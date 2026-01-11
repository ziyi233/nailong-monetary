import { createSign, createVerify } from 'crypto'

export interface EpayConfig {
  apiUrl: string
  pid: string
  platformPublicKey: string
  merchantPrivateKey: string
}

/**
 * Epay 支付核心类
 * 实现 RSA-SHA256 签名和验签
 */
export class EpayCore {
  constructor(private config: EpayConfig) {}

  /**
   * 构建支付表单 HTML
   */
  buildPayForm(params: {
    type: string
    outTradeNo: string
    name: string
    money: string
    notifyUrl: string
    returnUrl: string
  }): string {
    const requestParams: Record<string, string> = {
      pid: this.config.pid,
      type: params.type,
      out_trade_no: params.outTradeNo,
      name: params.name,
      money: params.money,
      notify_url: params.notifyUrl,
      return_url: params.returnUrl,
      timestamp: Math.floor(Date.now() / 1000).toString(),
    }

    requestParams.sign = this.generateSign(requestParams)
    requestParams.sign_type = 'RSA'

    const apiUrl = this.config.apiUrl + 'api/pay/submit'

    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>正在跳转...</title></head><body>`
    html += `<form id="dopay" action="${apiUrl}" method="post">`
    for (const [k, v] of Object.entries(requestParams)) {
      html += `<input type="hidden" name="${k}" value="${this.escapeHtml(v)}"/>`
    }
    html += `<input type="submit" value="正在跳转到支付页面..."></form>`
    html += `<script>document.getElementById("dopay").submit();</script></body></html>`

    return html
  }

  /**
   * 生成签名
   */
  generateSign(params: Record<string, string>): string {
    const signContent = this.getSignContent(params)
    const privateKeyPem = `-----BEGIN PRIVATE KEY-----\n${this.wordWrap(this.config.merchantPrivateKey, 64)}\n-----END PRIVATE KEY-----`

    const sign = createSign('RSA-SHA256')
    sign.update(signContent)
    return sign.sign(privateKeyPem, 'base64')
  }

  /**
   * 验证签名
   */
  verifySign(params: Record<string, string>): boolean {
    if (!params.sign) return false

    // 检查时间戳
    if (params.timestamp) {
      const ts = parseInt(params.timestamp, 10)
      if (Math.abs(Date.now() / 1000 - ts) > 300) {
        return false
      }
    }

    const sign = params.sign
    const signContent = this.getSignContent(params)
    const publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${this.wordWrap(this.config.platformPublicKey, 64)}\n-----END PUBLIC KEY-----`

    try {
      const verify = createVerify('RSA-SHA256')
      verify.update(signContent)
      return verify.verify(publicKeyPem, sign, 'base64')
    } catch {
      return false
    }
  }

  /**
   * 获取待签名字符串
   */
  private getSignContent(params: Record<string, string>): string {
    const keys = Object.keys(params)
      .filter(k => k !== 'sign' && k !== 'sign_type' && params[k]?.trim())
      .sort()

    return keys.map(k => `${k}=${params[k]}`).join('&')
  }

  /**
   * 字符串换行
   */
  private wordWrap(str: string, width: number): string {
    const lines: string[] = []
    for (let i = 0; i < str.length; i += width) {
      lines.push(str.slice(i, i + width))
    }
    return lines.join('\n')
  }

  /**
   * HTML 转义
   */
  private escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }
}
