/**
 * 充值页面模板
 * 二次元/黄色主题/现代化/大间距
 */

export interface ProductInfo {
  id: number
  name: string
  description?: string
  currency: string
  creditsPerYuan: number
  minAmountFen: number
  maxAmountFen?: number
}

interface RenderIndexOptions {
  basePath: string
  products: ProductInfo[]
}

/**
 * HTML 转义
 */
function escapeHtml(str: string): string {
  return str.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"')
}

/**
 * 格式化分为元
 */
function formatFen(fen: number): string {
  const yuan = fen / 100
  return yuan >= 1 ? `${yuan}` : `${fen}分`
}

const COMMON_STYLE = `
  :root {
    --primary: #fbbf24;
    --primary-hover: #f59e0b;
    --accent: #fcd34d;
    --bg: #fffbeb;
    --surface: #ffffff;
    --text-main: #451a03;
    --text-sub: #92400e;
    --border: #fde68a;
    --radius: 20px;
    --shadow: 0 8px 30px -5px rgba(251, 191, 36, 0.15);
  }

  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  
  body {
    font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    background-color: var(--bg);
    background-image: 
      radial-gradient(#fde68a 1px, transparent 1px),
      radial-gradient(#fde68a 1px, transparent 1px);
    background-size: 20px 20px;
    background-position: 0 0, 10px 10px;
    color: var(--text-main);
    line-height: 1.6;
    min-height: 100vh;
    padding: 20px 0 60px;
  }

  .main-wrapper {
    max-width: 520px;
    margin: 0 auto;
    padding: 0 24px;
  }

  /* 可爱的卡片风格 */
  .kawaii-card {
    background: var(--surface);
    border: 3px solid var(--text-main);
    border-radius: var(--radius);
    padding: 24px;
    margin-bottom: 24px;
    box-shadow: 6px 6px 0px var(--text-main);
    transition: transform 0.2s;
    position: relative;
    overflow: hidden;
  }
  
  .kawaii-card:hover { transform: translate(-2px, -2px); box-shadow: 8px 8px 0px var(--text-main); }

  .btn-primary {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 18px;
    background: var(--primary);
    color: var(--text-main);
    border: 3px solid var(--text-main);
    border-radius: var(--radius);
    font-size: 18px;
    font-weight: 800;
    cursor: pointer;
    text-decoration: none;
    box-shadow: 4px 4px 0px var(--text-main);
    transition: all 0.1s;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .btn-primary:active {
    transform: translate(2px, 2px);
    box-shadow: 2px 2px 0px var(--text-main);
  }
  
  .page-title {
    font-size: 28px;
    font-weight: 900;
    margin-bottom: 32px;
    color: var(--text-main);
    text-align: center;
    text-shadow: 2px 2px 0px #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }

  .section-label {
    font-size: 15px;
    font-weight: 800;
    color: var(--text-main);
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .section-label::before {
    content: '';
    display: block;
    width: 8px;
    height: 8px;
    background: var(--text-main);
    border-radius: 50%;
  }

  .input-field {
    width: 100%;
    padding: 16px;
    font-size: 18px;
    font-weight: 700;
    color: var(--text-main);
    background: #fff;
    border: 3px solid var(--border);
    border-radius: 12px;
    outline: none;
    transition: all 0.2s;
  }
  .input-field:focus {
    border-color: var(--text-main);
  }

  .floating-action {
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: var(--surface);
    border: 3px solid var(--text-main);
    border-radius: 50%;
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    box-shadow: 4px 4px 0px var(--text-main);
    z-index: 100;
    text-decoration: none;
    transition: all 0.2s;
  }
  .floating-action:active { transform: translate(2px, 2px); box-shadow: 2px 2px 0px var(--text-main); }
`;

/**
 * 渲染充值首页
 */
export function renderIndexPage(options: RenderIndexOptions): string {
  const { basePath, products } = options

  if (products.length === 0) {
    return renderNoProductPage(basePath)
  }

  const defaultProduct = products[0]

  const productOptions = products.map((p, idx) => `
    <label class="product-radio${idx === 0 ? ' selected' : ''}"
           data-id="${p.id}"
           data-rate="${p.creditsPerYuan}"
           data-min="${p.minAmountFen}"
           data-max="${p.maxAmountFen || 0}"
           data-currency="${escapeHtml(p.currency)}">
      <input type="radio" name="productRadio" value="${p.id}" ${idx === 0 ? 'checked' : ''}>
      <div class="product-inner">
        <div class="product-title">${escapeHtml(p.name)}</div>
        <div class="product-badge">1元 = ${p.creditsPerYuan}</div>
        ${p.description ? `<div class="product-desc">${escapeHtml(p.description)}</div>` : ''}
      </div>
      <div class="check-mark">✨</div>
    </label>
  `).join('')

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"/>
  <title>充值中心</title>
  <style>
    ${COMMON_STYLE}
    
    /* 顶部积分展示板 */
    .hero-banner {
      background: var(--primary);
      border: 3px solid var(--text-main);
      border-radius: var(--radius);
      padding: 32px 24px;
      text-align: center;
      margin-bottom: 32px;
      box-shadow: 8px 8px 0px var(--text-main);
      position: relative;
      overflow: hidden;
    }
    .hero-banner::after {
      content: '';
      position: absolute;
      top: -20px; right: -20px;
      width: 100px; height: 100px;
      background: rgba(255,255,255,0.2);
      border-radius: 50%;
    }
    .hero-label { font-size: 14px; font-weight: 800; opacity: 0.8; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px; }
    .hero-value { font-size: 48px; font-weight: 900; line-height: 1; margin-bottom: 4px; }
    .hero-hint { height: 20px; font-size: 13px; font-weight: 700; color: #b45309; }

    /* 商品选择 */
    .product-grid { display: grid; gap: 16px; margin-bottom: 32px; }
    .product-radio {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 20px;
      background: var(--surface);
      border: 3px solid var(--border);
      border-radius: 16px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .product-radio input { display: none; }
    .product-radio.selected {
      border-color: var(--text-main);
      background: #fffbeb;
    }
    .product-title { font-size: 18px; font-weight: 800; margin-bottom: 4px; }
    .product-badge { 
      display: inline-block;
      background: var(--primary);
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
      border: 2px solid var(--text-main);
    }
    .product-desc { font-size: 13px; color: var(--text-sub); margin-top: 6px; }
    .check-mark { font-size: 20px; opacity: 0; transform: scale(0); transition: all 0.2s; }
    .product-radio.selected .check-mark { opacity: 1; transform: scale(1); }

    /* 金额输入 */
    .amount-group { position: relative; margin-bottom: 16px; }
    .currency-suffix {
      position: absolute;
      right: 16px;
      top: 50%;
      transform: translateY(-50%);
      font-weight: 800;
      color: var(--text-sub);
    }

    /* 快捷金额 */
    .chips-row {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 32px;
    }
    .chip {
      flex: 1;
      min-width: 80px;
      padding: 12px;
      text-align: center;
      background: #fff;
      border: 2px solid var(--border);
      border-radius: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.1s;
      box-shadow: 2px 2px 0px var(--border);
    }
    .chip:active { transform: translate(2px, 2px); box-shadow: none; }
    .chip:hover { border-color: var(--text-main); }

    /* 支付方式 */
    .pay-methods { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 40px; }
    .pay-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 24px 16px;
      background: #fff;
      border: 3px solid var(--border);
      border-radius: 16px;
      cursor: pointer;
      transition: all 0.2s;
      position: relative;
    }
    .pay-card:hover { border-color: var(--primary); }
    .pay-card.selected {
      border-color: var(--text-main);
      background: #fffbeb;
      transform: translateY(-4px);
      box-shadow: 4px 4px 0 var(--text-main);
    }
    .pay-card input { display: none; }
    .pay-icon-box {
      width: 48px; 
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .pay-icon-box svg { width: 100%; height: 100%; display: block; }
    .pay-name { font-weight: 800; font-size: 15px; }
    .pay-check {
      position: absolute;
      top: 8px; right: 8px;
      font-size: 16px;
      opacity: 0;
      transform: scale(0);
      transition: all 0.2s;
    }
    .pay-card.selected .pay-check { opacity: 1; transform: scale(1); }

    /* 装饰元素 */
    .deco-circle {
      position: absolute;
      border-radius: 50%;
      background: var(--primary);
      opacity: 0.1;
      z-index: -1;
    }
  </style>
</head>
<body>
  <div class="deco-circle" style="width:300px;height:300px;top:-100px;left:-100px"></div>
  <div class="deco-circle" style="width:200px;height:200px;bottom:50px;right:-50px;background:#fcd34d"></div>

  <div class="main-wrapper">
    <div class="page-title">
      <span>⚡️ 充值中心</span>
    </div>

    <form method="POST" action="${basePath}/pay" id="payForm">
      
      <!-- 英雄榜（积分预览） -->
      <div class="hero-banner">
        <div class="hero-label">预计获得积分</div>
        <div class="hero-value" id="creditsValue">0</div>
        <div class="hero-hint" id="creditsError"></div>
      </div>

      <div class="section-label">充值账号</div>
      <div class="amount-group" style="margin-bottom: 32px;">
        <input class="input-field" type="text" name="qq" placeholder="请输入你的QQ号" required pattern="\\d{5,12}" inputmode="numeric">
      </div>

      <div class="section-label">充值金额</div>
      <div class="amount-group">
        <input class="input-field" type="number" id="money" name="money" placeholder="0.00" min="0.01" step="0.01" required inputmode="decimal" style="font-size: 24px;">
        <span class="currency-suffix">RMB</span>
      </div>
      <div class="chips-row">
        <div class="chip" onclick="setAmount(0.01)">0.01</div>
        <div class="chip" onclick="setAmount(1)">1</div>
        <div class="chip" onclick="setAmount(5)">5</div>
        <div class="chip" onclick="setAmount(10)">10</div>
        <div class="chip" onclick="setAmount(50)">50</div>
        <div class="chip" onclick="setAmount(100)">100</div>
      </div>

      <div class="section-label">选择商品</div>
      <div class="product-grid">
        ${productOptions}
      </div>
      <input type="hidden" name="productId" id="productId" value="${defaultProduct.id}">

      <div class="section-label">支付方式</div>
      <div class="pay-methods">
        <label class="pay-card selected">
          <input type="radio" name="type" value="alipay" checked>
          <div class="pay-icon-box">
            <svg viewBox="0 0 1024 1024"><path d="M1024 512c0 282.778-229.222 512-512 512S0 794.778 0 512 229.222 0 512 0s512 229.222 512 512z" fill="#1677FF"/><path d="M784.778 409.387l-42.539 21.504c-5.262 2.645-11.451-0.214-13.197-5.8-2.645-8.235-22.784-67.443-22.784-67.443H504.975c21.773 61.169 50.816 135.236 50.816 135.236 4.966 13.209 0.179 28.212-11.417 35.635-32.802 21.214-80.572 51.558-121.788 77.21 20.207 24.03 53.385 56.644 94.618 92.177 119.782-58.982 173.192-127.607 173.192-127.607 10.222-12.834 29.167-10.027 35.805 5.018l29.406 67.243c3.414 7.995 0.632 17.203-6.621 22.184-6.64 4.591-94.02 65.016-212.02 117.18-13.807 6.007-29.627 4.02-41.216-5.419-44.407-36.216-77.807-67.443-104.226-94.814-57.583 41.216-121.583 77.807-185.583 106.206-10.205 4.608-22.016-0.205-26.01-10.616l-32.221-85.213c-3-8.013 0.187-17.016 7-21.402 53.99-34.611 116.59-82.022 174-131.02-41.216-68.01-71.22-140.032-77.62-159.232-2.611-7.808-10.01-13.005-18.21-13.005H158.01c-8.807 0-16-7.194-16-16v-64c0-8.806 7.193-16 16-16h223.04v-52.019c0-8.807 7.193-16 16-16h76.013c8.806 0 16 7.193 16 16v52.019h217.04c8.806 0 16 7.194 16 16v64c0 8.806-7.194 16-16 16H582.042c3.788 15.616 23.996 81.024 23.996 81.024h137.6c8.806 0 16 7.194 16 16v53.026z" fill="#fff"/></svg>
          </div>
          <div class="pay-name">支付宝</div>
          <div class="pay-check">✨</div>
        </label>
        <label class="pay-card">
          <input type="radio" name="type" value="wxpay">
          <div class="pay-icon-box">
            <svg viewBox="0 0 1024 1024"><path d="M512 0C229.23 0 0 229.23 0 512s229.23 512 512 512 512-229.23 512-512S782.77 0 512 0z" fill="#09BB07"/><path d="M666.2 471.6c63.4 0 114.8-51.4 114.8-114.8s-51.4-114.8-114.8-114.8-114.8 51.4-114.8 114.8 51.4 114.8 114.8 114.8zM315 471.6c63.4 0 114.8-51.4 114.8-114.8S378.4 242 315 242 200.2 293.4 200.2 356.8c0 63.4 51.4 114.8 114.8 114.8z m359.8 82.2c-20.8 0-41 1.6-60.8 4.6 12.8 19 20.4 41.8 20.4 66.4 0 107.8-110.8 196.8-259 204.4 28.2 24.2 63.8 39.4 103.2 39.4 17.6 0 34.6-3 51-8.4l78.8 43.2-20.4-56.4c39.6-26.4 65.6-64 65.6-106.6 0-103-91.8-186.6-204-186.6h25.2zM277.8 775.2c-15.6 0-30.6-2.6-45.2-7.4l-69.6 38.2 18-49.8C146 732.8 123 699.6 123 662c0-91 101.4-165 226.4-165s226.4 74 226.4 165-101.4 113.2-226.4 113.2-71.6 0-71.6 0z" fill="#fff"/></svg>
          </div>
          <div class="pay-name">微信支付</div>
          <div class="pay-check">✨</div>
        </label>
      </div>

      <button type="submit" class="btn-primary">
        立即支付
      </button>
      
      <a href="${basePath}/query" style="display:block;text-align:center;color:var(--text-sub);font-size:14px;font-weight:700;margin-top:24px;text-decoration:none;padding:12px;opacity:0.8">
        🧐 查询充值记录
      </a>
    </form>
  </div>

  <script>
    let currentProduct = {
      id: ${defaultProduct.id},
      rate: ${defaultProduct.creditsPerYuan},
      minFen: ${defaultProduct.minAmountFen},
      maxFen: ${defaultProduct.maxAmountFen || 0},
      currency: '${escapeHtml(defaultProduct.currency)}'
    };

    document.querySelectorAll('.product-radio').forEach(item => {
      item.addEventListener('click', function() {
        if(this.classList.contains('selected')) return;
        document.querySelectorAll('.product-radio').forEach(i => i.classList.remove('selected'));
        this.classList.add('selected');
        this.querySelector('input').checked = true;

        currentProduct = {
          id: parseInt(this.dataset.id),
          rate: parseInt(this.dataset.rate),
          minFen: parseInt(this.dataset.min),
          maxFen: parseInt(this.dataset.max),
          currency: this.dataset.currency
        };

        document.getElementById('productId').value = currentProduct.id;
        updateCredits();
      });
    });

    document.querySelectorAll('.pay-card').forEach(item => {
      item.addEventListener('click', function() {
        document.querySelectorAll('.pay-card').forEach(i => i.classList.remove('selected'));
        this.classList.add('selected');
        this.querySelector('input').checked = true;
      });
    });

    const moneyInput = document.getElementById('money');
    const creditsValue = document.getElementById('creditsValue');
    const creditsError = document.getElementById('creditsError');

    moneyInput.addEventListener('input', updateCredits);

    function updateCredits() {
      const v = parseFloat(moneyInput.value);
      creditsError.textContent = '';
      
      if (!v || v < 0.01) {
        creditsValue.textContent = '0';
        return;
      }

      const amountFen = Math.round(v * 100);
      let error = '';
      if (amountFen < currentProduct.minFen) {
        error = '起充 ' + (currentProduct.minFen / 100) + ' 元';
      } else if (currentProduct.maxFen > 0 && amountFen > currentProduct.maxFen) {
        error = '限额 ' + (currentProduct.maxFen / 100) + ' 元';
      }
      
      creditsError.textContent = error;
      const credits = Math.floor(v * currentProduct.rate);
      creditsValue.textContent = credits.toLocaleString();
    }

    function setAmount(n) {
      moneyInput.value = n;
      updateCredits();
    }

    document.getElementById('payForm').addEventListener('submit', function(e) {
      const v = parseFloat(moneyInput.value);
      if (!v || v < 0.01) {
        e.preventDefault();
        alert('请输入有效的金额');
        return;
      }
      const amountFen = Math.round(v * 100);
      if (amountFen < currentProduct.minFen) {
        e.preventDefault();
        alert('最低充值 ' + (currentProduct.minFen / 100) + ' 元');
        return;
      }
      if (currentProduct.maxFen > 0 && amountFen > currentProduct.maxFen) {
        e.preventDefault();
        alert('最高充值 ' + (currentProduct.maxFen / 100) + ' 元');
        return;
      }
    });
  </script>
</body>
</html>`
}

/**
 * 无商品页面
 */
function renderNoProductPage(basePath: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>暂无服务</title>
  <style>
    ${COMMON_STYLE}
    body { display: flex; align-items: center; justify-content: center; text-align: center; }
  </style>
</head>
<body>
  <div class="kawaii-card">
    <div style="font-size: 48px; margin-bottom: 16px;">💤</div>
    <h2 style="font-size: 20px; margin-bottom: 12px;">休息中...</h2>
    <p style="margin-bottom: 24px;">暂时没有可用的充值商品哦</p>
    <a href="${basePath}" class="btn-primary" style="padding: 12px; font-size: 14px;">刷新看看</a>
  </div>
</body>
</html>`
}

/**
 * 渲染支付成功页面
 */
export function renderSuccessPage(orderNo: string, amount: string, credits: number, basePath: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>支付成功</title>
  <style>
    ${COMMON_STYLE}
    body { display: flex; align-items: center; justify-content: center; }
  </style>
</head>
<body>
  <div class="main-wrapper" style="width: 100%">
    <div class="kawaii-card" style="text-align: center; border-color: #10b981; box-shadow: 6px 6px 0 #10b981;">
      <div style="font-size: 64px; margin-bottom: 16px;">🎉</div>
      <h2 style="font-size: 24px; margin-bottom: 8px; color: #10b981;">支付成功!</h2>
      <p style="font-size: 13px; color: var(--text-sub); margin-bottom: 24px;">订单号: ${escapeHtml(orderNo)}</p>
      
      <div style="background: #ecfdf5; padding: 20px; border-radius: 12px; margin-bottom: 24px;">
        <div style="font-size: 32px; font-weight: 900;">¥${escapeHtml(amount)}</div>
        <div style="color: #059669; font-weight: 800; margin-top: 8px;">获得 ${credits.toLocaleString()} 积分</div>
      </div>

      <a href="${basePath}" class="btn-primary" style="background: #10b981; border-color: #065f46; color: white; box-shadow: 4px 4px 0 #065f46;">返回首页</a>
    </div>
  </div>
</body>
</html>`
}

/**
 * 渲染支付失败页面
 */
export function renderErrorPage(message: string, basePath: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>支付失败</title>
  <style>
    ${COMMON_STYLE}
    body { display: flex; align-items: center; justify-content: center; }
  </style>
</head>
<body>
  <div class="main-wrapper" style="width: 100%">
    <div class="kawaii-card" style="text-align: center; border-color: #ef4444; box-shadow: 6px 6px 0 #ef4444;">
      <div style="font-size: 64px; margin-bottom: 16px;">😵‍💫</div>
      <h2 style="font-size: 24px; margin-bottom: 12px; color: #ef4444;">出错了</h2>
      <p style="margin-bottom: 32px; font-weight: 600;">${escapeHtml(message)}</p>
      <a href="${basePath}" class="btn-primary" style="background: #fff; color: #ef4444; border-color: #ef4444; box-shadow: 4px 4px 0 #ef4444;">返回重试</a>
    </div>
  </div>
</body>
</html>`
}

/**
 * 渲染查询页面
 */
export function renderQueryPage(basePath: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>我的记录</title>
  <style>
    ${COMMON_STYLE}
    
    .search-box {
      display: flex;
      gap: 12px;
      margin-bottom: 32px;
    }
    
    .record-card {
      background: #fff;
      border: 2px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .record-date { font-size: 12px; color: var(--text-sub); font-weight: 600; }
    .record-val { font-size: 18px; font-weight: 800; }
    
    .badge {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 800;
      margin-left: 6px;
      border: 1px solid currentColor;
    }
    .badge-ok { color: #10b981; background: #ecfdf5; }
    .badge-wait { color: #f59e0b; background: #fffbeb; }

    .stat-box {
      background: var(--primary);
      color: var(--text-main);
      padding: 24px;
      border-radius: var(--radius);
      border: 3px solid var(--text-main);
      box-shadow: 4px 4px 0 var(--text-main);
      text-align: center;
      margin-bottom: 32px;
    }
  </style>
</head>
<body>
  <div class="main-wrapper">
    <div class="page-title">
      <a href="${basePath}" style="text-decoration:none;color:var(--text-main);position:absolute;left:24px;font-size:24px">←</a>
      充值记录
    </div>

    <div class="search-box">
      <input class="input-field" type="text" id="userId" placeholder="输入QQ号查询..." inputmode="numeric">
      <button class="btn-primary" style="width: auto; padding: 0 24px;" onclick="query()">GO</button>
    </div>

    <div id="result">
      <div style="text-align:center;padding:60px 0;opacity:0.5;font-weight:700">
        输入账号查看历史记录
      </div>
    </div>
  </div>

  <script>
    async function query() {
      const userId = document.getElementById('userId').value.trim();
      if (!userId) { alert('请输入账号'); return; }

      const resultEl = document.getElementById('result');
      resultEl.innerHTML = '<div style="text-align:center;padding:40px;font-weight:700">加载中...</div>';

      try {
        const res = await fetch('${basePath}/api/query?userId=' + encodeURIComponent(userId));
        const data = await res.json();

        if (data.error) {
          resultEl.innerHTML = '<div style="text-align:center;color:#ef4444;font-weight:700;padding:20px">' + data.error + '</div>';
          return;
        }

        let html = '';
        
        html += '<div class="stat-box">';
        html += '<div style="font-size:13px;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Current Balance</div>';
        html += '<div style="font-size:40px;font-weight:900;line-height:1">' + (data.credits || 0).toLocaleString() + '</div>';
        html += '</div>';

        if (data.orders && data.orders.length) {
          html += '<div class="section-label">HISTORY</div>';
          data.orders.forEach(function(o) {
            const isSuccess = o.status === 'success';
            const badge = isSuccess ? '<span class="badge badge-ok">SUCCESS</span>' : '<span class="badge badge-wait">WAIT</span>';
            
            html += '<div class="record-card">';
            html += '<div>';
            html += '<div class="record-date">' + new Date(o.createdAt).toLocaleDateString() + badge + '</div>';
            html += '<div style="font-weight:700;margin-top:2px">充值 ¥' + o.amount + '</div>';
            html += '</div>';
            html += '<div class="record-val">+' + o.credits.toLocaleString() + '</div>';
            html += '</div>';
          });
        } else {
          html += '<div style="text-align:center;padding:40px 0;font-weight:600;opacity:0.6">这里空空如也</div>';
        }

        resultEl.innerHTML = html;
      } catch (err) {
        resultEl.innerHTML = '<div style="text-align:center;font-weight:700;color:#ef4444">网络有点问题</div>';
      }
    }
    
    document.getElementById('userId').addEventListener('keypress', function(e) {
      if (e.key === 'Enter') query();
    });
  </script>
</body>
</html>`
}

/**
 * 渲染管理员登录页面
 */
export function renderAdminLoginPage(basePath: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ADMIN</title>
  <style>
    ${COMMON_STYLE}
    body { display: flex; align-items: center; justify-content: center; background: #222; }
    .kawaii-card { background: #fff; border: none; box-shadow: 0 20px 50px rgba(0,0,0,0.5); max-width: 400px; width: 100%; }
  </style>
</head>
<body>
  <div class="main-wrapper" style="width:100%">
    <div class="kawaii-card">
      <h2 style="text-align:center;margin-bottom:32px;font-weight:900;font-size:28px">ACCESS CONTROL</h2>
      <div id="error" style="background:#fee2e2;color:#ef4444;padding:12px;border-radius:8px;margin-bottom:20px;display:none;font-weight:700;text-align:center"></div>
      <form onsubmit="login(event)">
        <div style="margin-bottom:24px">
          <input class="input-field" type="password" id="password" placeholder="Passphrase" required style="text-align:center;letter-spacing:4px">
        </div>
        <button type="submit" class="btn-primary" style="background:#000;color:#fff;border-color:#000;box-shadow:4px 4px 0 #666">UNLOCK</button>
      </form>
    </div>
  </div>
  <script>
    async function login(e) {
      e.preventDefault();
      const password = document.getElementById('password').value;
      const errorEl = document.getElementById('error');
      errorEl.style.display = 'none';
      try {
        const res = await fetch('${basePath}/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        const data = await res.json();
        if (data.success) {
          window.location.reload();
        } else {
          errorEl.textContent = 'ACCESS DENIED';
          errorEl.style.display = 'block';
        }
      } catch (err) {
        errorEl.textContent = 'NETWORK ERROR';
        errorEl.style.display = 'block';
      }
    }
  </script>
</body>
</html>`
}

/**
 * 渲染管理后台页面
 */
export function renderAdminPage(basePath: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Admin</title>
  <style>
    ${COMMON_STYLE}
    body { display: flex; align-items: center; justify-content: center; }
  </style>
</head>
<body>
  <div class="main-wrapper">
    <div class="kawaii-card" style="text-align:center">
      <div style="font-size:48px;margin-bottom:16px">🚀</div>
      <h2 style="font-weight:900;margin-bottom:16px">MOVED</h2>
      <p style="margin-bottom:32px;font-weight:600">Please use Koishi Console.</p>
      <a href="${basePath}" class="btn-primary">BACK</a>
    </div>
  </div>
</body>
</html>`
}
