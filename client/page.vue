<template>
  <div class="nailong-admin-wrapper">
    <div class="pop-container">
      <div class="header-section">
        <div class="brand">
          <div class="logo">⚡️</div>
          <h1>积分充值管理</h1>
        </div>
        <div class="header-actions">
          <button @click="activeTab = 'orders'" :class="['pop-btn', { active: activeTab === 'orders' }]">
            📜 订单列表
          </button>
          <button @click="activeTab = 'products'; loadProducts()" :class="['pop-btn', { active: activeTab === 'products' }]">
            🎁 商品配置
          </button>
        </div>
      </div>

      <!-- 订单管理 -->
      <div v-if="activeTab === 'orders'" class="content-body">
        <!-- 数据概览 -->
        <div class="stats-grid">
          <div class="pop-card stat-item primary">
            <div class="stat-icon">💰</div>
            <div class="stat-info">
              <div class="label">总交易额</div>
              <div class="value">¥{{ stats.totalAmount.toFixed(2) }}</div>
            </div>
          </div>
          <div class="pop-card stat-item info">
            <div class="stat-icon">💎</div>
            <div class="stat-info">
              <div class="label">积分发放</div>
              <div class="value">{{ stats.totalCredits.toLocaleString() }}</div>
            </div>
          </div>
          <div class="pop-card stat-item success">
            <div class="stat-icon">✅</div>
            <div class="stat-info">
              <div class="label">成功订单</div>
              <div class="value">{{ stats.successCount }}</div>
            </div>
          </div>
          <div class="pop-card stat-item warning">
            <div class="stat-icon">⏳</div>
            <div class="stat-info">
              <div class="label">待处理</div>
              <div class="value">{{ stats.pendingCount }}</div>
            </div>
          </div>
        </div>

        <!-- 筛选栏 -->
        <div class="pop-card filter-bar">
          <div class="search-box">
            <span class="icon">🔍</span>
            <input class="pop-input" v-model="filters.userId" placeholder="搜索用户ID..." @keyup.enter="loadOrders" />
          </div>
          
          <select v-model="filters.status" class="pop-select">
            <option value="all">全部状态</option>
            <option value="success">支付成功</option>
            <option value="pending">等待支付</option>
            <option value="failed">支付失败</option>
          </select>

          <div class="spacer"></div>

          <button class="pop-btn primary" @click="loadOrders">查询</button>
          <button class="pop-btn" @click="resetFilters">重置</button>
        </div>

        <!-- 订单表格 -->
        <div class="pop-card table-card">
          <table>
            <thead>
              <tr>
                <th>订单号</th>
                <th>用户ID</th>
                <th>金额</th>
                <th>积分</th>
                <th>支付方式</th>
                <th>状态</th>
                <th>时间</th>
                <th align="right">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="order in orders" :key="order.outTradeNo">
                <td class="mono">{{ order.outTradeNo }}</td>
                <td><span class="user-badge">{{ order.userId }}</span></td>
                <td class="amount">¥{{ order.amount.toFixed(2) }}</td>
                <td class="credits">+{{ order.credits }}</td>
                <td>
                  <span class="tag" :class="order.payType">{{ payTypeText(order.payType) }}</span>
                </td>
                <td>
                  <span class="status-badge" :class="order.status">{{ statusText(order.status) }}</span>
                </td>
                <td class="time">{{ formatDate(order.createdAt) }}</td>
                <td align="right">
                  <div class="actions">
                    <button 
                      v-if="order.status === 'pending'"
                      class="icon-btn success"
                      title="补单"
                      @click="completeOrder(order.outTradeNo)"
                    >
                      ✓
                    </button>
                    <button 
                      class="icon-btn danger"
                      title="删除"
                      @click="deleteOrder(order.outTradeNo)"
                    >
                      ✕
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="orders.length === 0">
                <td colspan="8" class="empty-cell">
                  <div class="empty-state">
                    <span class="emoji">📦</span>
                    <p>暂无订单数据</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <div class="pagination" v-if="totalPages > 1">
            <button class="pop-btn small" :disabled="page <= 1" @click="goPage(page - 1)">←</button>
            <span>{{ page }} / {{ totalPages }}</span>
            <button class="pop-btn small" :disabled="page >= totalPages" @click="goPage(page + 1)">→</button>
          </div>
        </div>

        <div class="link-bar" v-if="config?.enabled">
          <a :href="rechargeUrl" target="_blank">👉 前往充值页面</a>
        </div>
      </div>

      <!-- 商品管理 -->
      <div v-if="activeTab === 'products'" class="content-body">
        <div class="toolbar">
          <div class="spacer"></div>
          <button class="pop-btn primary large" @click="openProductModal()">
            + 添加商品
          </button>
        </div>

        <div class="product-grid">
          <div v-if="productsLoading" class="loading-state">加载中...</div>
          <div v-else-if="products.length === 0" class="empty-state">
            <span class="emoji">🍃</span>
            <p>暂无商品</p>
          </div>
          
          <div v-for="product in products" :key="product.id" class="pop-card product-item">
            <div class="p-head">
              <span class="p-order">#{{ product.order }}</span>
              <span class="p-status" :class="{ on: product.enabled }">{{ product.enabled ? '🟢 上架' : '🔴 下架' }}</span>
            </div>
            
            <div class="p-main">
              <h3>{{ product.name }}</h3>
              <p>{{ product.description || '暂无描述' }}</p>
              <div class="p-tags">
                <span class="tag rate">1元={{ product.creditsPerYuan }}</span>
                <span class="tag min">{{ formatFen(product.minAmountFen) }}起</span>
                <span class="tag max" v-if="product.maxAmountFen">限{{ formatFen(product.maxAmountFen) }}</span>
              </div>
            </div>

            <div class="p-foot">
              <span class="currency">{{ product.currency }}</span>
              <div class="actions">
                <button class="pop-btn small" @click="openProductModal(product)">编辑</button>
                <button class="pop-btn small danger" @click="deleteProduct(product.id)">删除</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 弹窗 -->
    <div v-if="showProductModal" class="modal-mask" @click.self="showProductModal = false">
      <div class="pop-card modal-box">
        <div class="modal-head">
          <h3>{{ editingProduct.id ? '✏️ 编辑商品' : '✨ 新建商品' }}</h3>
          <span class="close" @click="showProductModal = false">✕</span>
        </div>
        <div class="modal-content">
          <div class="form-item">
            <label>商品名称</label>
            <input class="pop-input" v-model="editingProduct.name" placeholder="例如：10元积分包" />
          </div>
          <div class="form-item">
            <label>描述</label>
            <input class="pop-input" v-model="editingProduct.description" placeholder="商品说明..." />
          </div>
          <div class="form-row">
            <div class="form-item">
              <label>货币类型</label>
              <input class="pop-input" v-model="editingProduct.currency" />
            </div>
            <div class="form-item">
              <label>兑换比例 (积分/元)</label>
              <input class="pop-input" type="number" v-model.number="editingProduct.creditsPerYuan" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-item">
              <label>起充金额 (分)</label>
              <input class="pop-input" type="number" v-model.number="editingProduct.minAmountFen" />
            </div>
            <div class="form-item">
              <label>限额 (分)</label>
              <input class="pop-input" type="number" v-model.number="editingProduct.maxAmountFen" />
            </div>
          </div>
          <div class="form-row">
            <div class="form-item">
              <label>排序</label>
              <input class="pop-input" type="number" v-model.number="editingProduct.order" />
            </div>
            <div class="form-item center">
              <label class="checkbox-label">
                <input type="checkbox" v-model="editingProduct.enabled">
                上架销售
              </label>
            </div>
          </div>
        </div>
        <div class="modal-foot">
          <div class="preview-text">
            预览: 充值 <b>{{ formatFen(editingProduct.minAmountFen) }}</b> 获得 
            <b>{{ Math.floor((editingProduct.minAmountFen/100)*editingProduct.creditsPerYuan) }}</b> {{ editingProduct.currency }}
          </div>
          <div class="foot-actions">
            <button class="pop-btn" @click="showProductModal = false">取消</button>
            <button class="pop-btn primary" @click="saveProduct">保存</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, reactive, computed, onMounted } from 'vue'
import { useRpc, send } from '@koishijs/client'

// 类型定义
interface RechargeConfig { enabled: boolean; port: number; basePath: string; baseUrl: string; adminPassword: string }
interface Order { outTradeNo: string; userId: string; amount: number; credits: number; payType: string; status: 'pending' | 'success' | 'failed'; createdAt: string }
interface Stats { totalAmount: number; totalCredits: number; successCount: number; pendingCount: number; failedCount: number }
interface Product { id?: number; name: string; description?: string; currency: string; creditsPerYuan: number; minAmountFen: number; maxAmountFen?: number; enabled: boolean; order: number }

export default defineComponent({
  setup() {
    const rpcSend = send as (type: string, ...args: any[]) => Promise<any>

    const config = useRpc<RechargeConfig>()
    const activeTab = ref<'orders' | 'products'>('orders')
    const loading = ref(false)
    const productsLoading = ref(false)
    const showProductModal = ref(false)
    const orders = ref<Order[]>([])
    const products = ref<Product[]>([])
    const page = ref(1)
    const pageSize = 20
    const total = ref(0)

    const stats = reactive<Stats>({ totalAmount: 0, totalCredits: 0, successCount: 0, pendingCount: 0, failedCount: 0 })
    const filters = reactive({ userId: '', status: 'all', startDate: '', endDate: '' })
    const editingProduct = reactive<Product>({ name: '', description: '', currency: 'default', creditsPerYuan: 100, minAmountFen: 100, maxAmountFen: undefined, enabled: true, order: 0 })

    const totalPages = computed(() => Math.ceil(total.value / pageSize))
    const rechargeUrl = computed(() => {
      if (!config.value) return ''
      if (config.value.baseUrl) {
        const baseUrl = config.value.baseUrl.replace(/\/$/, '')
        const basePath = config.value.basePath.replace(/^\//, '')
        return `${baseUrl}/${basePath}`
      }
      return `http://localhost:${config.value.port}${config.value.basePath}`
    })

    // 辅助函数
    const payTypeText = (t: string) => ({ alipay: '支付宝', wxpay: '微信' }[t] || t)
    const statusText = (s: string) => ({ success: '成功', pending: '待付', failed: '失败' }[s] || s)
    const formatDate = (s: string) => new Date(s).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    const formatFen = (f: number | undefined) => !f ? '0元' : (f / 100 >= 1 ? `${f / 100}元` : `${f}分`)

    // 业务逻辑
    const loadOrders = async () => {
      loading.value = true
      try {
        const res = await rpcSend('nailong-monetary/orders', { page: page.value, pageSize, ...filters })
        orders.value = res.orders; total.value = res.total; Object.assign(stats, res.stats)
      } catch (e) { console.error(e) } finally { loading.value = false }
    }

    const resetFilters = () => { filters.userId = ''; filters.status = 'all'; page.value = 1; loadOrders() }
    const goPage = (p: number) => { page.value = p; loadOrders() }
    const completeOrder = async (no: string) => { if(confirm('确认补单?')) { await rpcSend('nailong-monetary/complete', { outTradeNo: no }); loadOrders() } }
    const deleteOrder = async (no: string) => { if(confirm('确认删除?')) { await rpcSend('nailong-monetary/delete', { outTradeNo: no }); loadOrders() } }

    const loadProducts = async () => {
      productsLoading.value = true
      try { products.value = (await rpcSend('nailong-monetary/products')).products } finally { productsLoading.value = false }
    }

    const openProductModal = (p?: Product) => {
      Object.assign(editingProduct, p || { id: undefined, name: '', description: '', currency: 'default', creditsPerYuan: 100, minAmountFen: 100, maxAmountFen: undefined, enabled: true, order: products.value.length })
      showProductModal.value = true
    }

    const saveProduct = async () => {
      if (!editingProduct.name) return alert('请输入名称')
      await rpcSend('nailong-monetary/product/save', { ...editingProduct })
      showProductModal.value = false; loadProducts()
    }

    const deleteProduct = async (id: number) => { if(confirm('确认删除?')) { await rpcSend('nailong-monetary/product/delete', { id }); loadProducts() } }

    onMounted(loadOrders)

    return {
      config, activeTab, loading, productsLoading, showProductModal, orders, products, page, pageSize, total,
      stats, filters, editingProduct, totalPages, rechargeUrl,
      payTypeText, statusText, formatDate, formatFen,
      loadOrders, resetFilters, goPage, completeOrder, deleteOrder,
      loadProducts, openProductModal, saveProduct, deleteProduct
    }
  }
})
</script>

<style scoped lang="scss">
/* 核心变量定义 */
.nailong-admin-wrapper {
  /* 定义局部变量 */
  --nl-primary: #fbbf24;
  --nl-bg: #fffbeb;
  --nl-surface: #ffffff;
  --nl-text: #451a03;
  --nl-border: 3px solid #451a03;
  --nl-shadow: 4px 4px 0 #451a03;

  /* 核心修复：不使用 fixed，而是填充父容器 */
  width: 100%;
  min-height: 100%;
  box-sizing: border-box;
  
  font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  color: var(--nl-text);
  
  /* 应用自定义背景到当前容器，而不是覆盖全局 */
  background-color: var(--nl-bg);
  background-image: 
    radial-gradient(#fde68a 1px, transparent 1px),
    radial-gradient(#fde68a 1px, transparent 1px);
  background-size: 20px 20px;
  background-position: 0 0, 10px 10px;
  
  /* 确保这个容器能盖住 Koishi 默认的透明背景 */
  position: absolute;
  top: 0;
  left: 0;
  z-index: 0; /* 降低层级，让侧边栏浮上来 */
  
  /* 解决滚动问题 */
  overflow-y: auto;
  padding: 32px;
}

.pop-container {
  max-width: 1200px;
  margin: 0 auto;
  /* 移除 padding，由 wrapper 统一控制 */
}

/* 头部 */
.header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  
  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
    
    .logo { 
      font-size: 32px; 
      background: var(--nl-primary); 
      width: 56px; height: 56px; 
      border-radius: 12px; 
      border: var(--nl-border);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 2px 2px 0 #451a03;
    }
    
    h1 { 
      margin: 0; font-size: 28px; font-weight: 900; 
      text-shadow: 2px 2px 0 #fff;
    }
  }
  
  .header-actions {
    display: flex; gap: 16px;
  }
}

/* 波普风格组件 */
.pop-card {
  background: var(--nl-surface);
  border: var(--nl-border);
  border-radius: 16px;
  box-shadow: var(--nl-shadow);
  transition: transform 0.1s;
  
  &:hover { transform: translate(-2px, -2px); box-shadow: 6px 6px 0 #451a03; }
}

.pop-btn {
  padding: 10px 20px;
  border: var(--nl-border);
  border-radius: 12px;
  background: var(--nl-surface);
  color: var(--nl-text);
  font-weight: 800;
  cursor: pointer;
  box-shadow: 2px 2px 0 #451a03;
  transition: all 0.1s;
  font-size: 14px;
  
  &:hover { transform: translate(-1px, -1px); box-shadow: 3px 3px 0 #451a03; }
  &:active { transform: translate(1px, 1px); box-shadow: 1px 1px 0 #451a03; }
  
  &.active { background: var(--nl-primary); }
  &.primary { background: var(--nl-primary); }
  &.danger { background: #fee2e2; color: #dc2626; border-color: #dc2626; box-shadow: 2px 2px 0 #dc2626; }
  &.small { padding: 4px 12px; font-size: 12px; border-width: 2px; box-shadow: 1px 1px 0 #451a03; }
  &.large { padding: 12px 24px; font-size: 16px; }
}

.pop-input, .pop-select {
  padding: 10px 14px;
  border: 2px solid var(--nl-text);
  border-radius: 10px;
  outline: none;
  font-weight: 600;
  color: var(--nl-text);
  background: #fff;
  transition: all 0.2s;
  
  &:focus { border-color: var(--nl-primary); box-shadow: 0 0 0 3px rgba(251, 191, 36, 0.3); }
}

/* 统计卡片 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
}

.stat-item {
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  
  .stat-icon { font-size: 32px; }
  .label { font-size: 14px; color: #92400e; font-weight: 700; margin-bottom: 4px; }
  .value { font-size: 28px; font-weight: 900; line-height: 1; }
  
  &.primary { background: #fffbeb; }
  &.info { background: #eff6ff; }
  &.success { background: #f0fdf4; }
  &.warning { background: #fff7ed; }
}

/* 筛选栏 */
.filter-bar {
  padding: 20px;
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.search-box {
  position: relative;
  .icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); opacity: 0.5; }
  input { padding-left: 36px; width: 240px; }
}

.spacer { flex: 1; }

/* 表格 */
.table-card {
  padding: 0;
  overflow: hidden;
  margin-bottom: 24px;
}

table {
  width: 100%; border-collapse: collapse;
  th { text-align: left; padding: 16px 24px; background: #fff7ed; border-bottom: 2px solid var(--nl-text); font-weight: 800; color: #92400e; }
  td { padding: 16px 24px; border-bottom: 2px solid #fef3c7; font-weight: 600; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: #fffbeb; }
}

.mono { font-family: monospace; font-size: 14px; }
.amount { font-size: 16px; font-weight: 800; }
.credits { color: #d97706; font-weight: 800; }
.user-badge { background: #f3f4f6; padding: 4px 8px; border-radius: 6px; font-size: 13px; }

.status-badge {
  padding: 4px 10px; border-radius: 20px; font-size: 12px; border: 2px solid;
  &.success { background: #dcfce7; border-color: #10b981; color: #15803d; }
  &.pending { background: #ffedd5; border-color: #f97316; color: #c2410c; }
  &.failed { background: #fee2e2; border-color: #ef4444; color: #b91c1c; }
}

.tag { font-size: 12px; padding: 2px 6px; border-radius: 4px; background: #f3f4f6; border: 1px solid #e5e7eb; }

.icon-btn {
  width: 32px; height: 32px; border-radius: 8px; border: 2px solid; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; margin-left: 8px; font-weight: 800; transition: transform 0.1s;
  &:active { transform: scale(0.95); }
  &.success { background: #dcfce7; border-color: #10b981; color: #15803d; }
  &.danger { background: #fee2e2; border-color: #ef4444; color: #b91c1c; }
}

.empty-state {
  text-align: center; padding: 60px;
  .emoji { font-size: 48px; margin-bottom: 16px; display: block; }
  p { font-weight: 700; color: #92400e; }
}

.pagination {
  padding: 20px; border-top: 2px solid #fef3c7; display: flex; justify-content: flex-end; align-items: center; gap: 12px; font-weight: 700;
}

.link-bar { text-align: center; a { color: #92400e; font-weight: 700; text-decoration: none; border-bottom: 2px dashed; &:hover { color: var(--nl-text); border-style: solid; } } }

/* 商品网格 */
.product-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 24px;
}

.product-item {
  padding: 24px;
  display: flex;
  flex-direction: column;
  height: 100%;
  
  .p-head { display: flex; justify-content: space-between; margin-bottom: 16px; font-weight: 700; color: #92400e; font-size: 13px; }
  .p-status.on { color: #15803d; }
  
  .p-main {
    flex: 1;
    h3 { margin: 0 0 8px; font-size: 20px; font-weight: 900; line-height: 1.4; word-break: break-all; }
    p { margin: 0 0 20px; color: #92400e; font-size: 14px; line-height: 1.5; min-height: 42px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  }
  
  .p-tags { 
    display: flex; gap: 8px; margin-bottom: 24px; flex-wrap: wrap;
    .tag { background: var(--nl-bg); border: 2px solid var(--nl-border); padding: 4px 8px; border-radius: 8px; font-weight: 700; font-size: 12px; white-space: nowrap; }
    .rate { color: #d97706; }
  }
  
  .p-foot {
    display: flex; justify-content: space-between; align-items: center; border-top: 2px dashed var(--nl-border); padding-top: 16px; margin-top: auto;
    .currency { font-weight: 700; color: #92400e; font-size: 13px; }
    .actions { display: flex; gap: 8px; }
  }
}

/* 弹窗 */
.modal-mask {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(69, 26, 3, 0.6); backdrop-filter: blur(4px);
  z-index: 1000; display: flex; align-items: center; justify-content: center;
}

.modal-box {
  width: 520px; max-width: 95%; padding: 0; overflow: hidden;
  animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes popIn { from { opacity: 0; transform: scale(0.8) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }

.modal-head {
  padding: 20px 32px; border-bottom: 2px solid var(--nl-bg); background: #fff7ed; display: flex; justify-content: space-between; align-items: center;
  h3 { margin: 0; font-size: 20px; font-weight: 900; }
  .close { cursor: pointer; font-size: 24px; font-weight: 800; color: #92400e; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 8px; transition: background 0.2s; &:hover { color: var(--nl-text); background: rgba(0,0,0,0.05); } }
}

.modal-content { padding: 32px; max-height: 70vh; overflow-y: auto; }

.form-item { margin-bottom: 24px; label { display: block; font-weight: 800; font-size: 14px; margin-bottom: 10px; color: #92400e; } input { width: 100%; box-sizing: border-box; } }
.form-row { display: flex; gap: 24px; .form-item { flex: 1; min-width: 0; } }

.checkbox-label { display: flex; align-items: center; gap: 12px; cursor: pointer; font-weight: 700; color: var(--nl-text); input { width: 24px; height: 24px; accent-color: var(--nl-primary); margin: 0; flex-shrink: 0; } }

.modal-foot {
  padding: 24px 32px; background: var(--nl-bg); border-top: 2px solid var(--nl-border);
  .preview-text { margin-bottom: 20px; font-size: 14px; color: #92400e; font-weight: 600; line-height: 1.6; background: #fff; padding: 12px; border-radius: 12px; border: 2px dashed var(--nl-border); b { color: #d97706; } }
  .foot-actions { display: flex; justify-content: flex-end; gap: 16px; }
}

.loading-state { grid-column: 1/-1; text-align: center; padding: 60px; font-weight: 700; color: #92400e; }
</style>
