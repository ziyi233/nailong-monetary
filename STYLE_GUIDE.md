# Koishi 控制台插件样式覆盖指南

本文档记录了如何在 Koishi 控制台插件中覆盖默认主题背景色，实现自定义的全屏或内容区背景样式（如二次元主题、暗黑主题等），同时保留 Koishi 原生侧边栏导航。

## 核心原理

Koishi 控制台使用了 `k-layout` 组件作为基础布局，该组件内部定义了背景色、文字颜色等 CSS 变量。要实现自定义背景，我们需要：

1.  **使用 Scoped CSS**：防止污染其他插件或全局样式。
2.  **样式穿透 (`:deep`)**：因为 `k-layout` 是子组件，我们需要穿透 Scoped 作用域去修改它的内部样式。
3.  **优先级覆盖 (`!important`)**：Koishi 的样式优先级较高，通常需要 `!important` 来强制覆盖背景属性。
4.  **变量隔离**：定义一套自己的 CSS 变量（如 `--my-primary`），避免直接修改 Koishi 的全局变量（如 `--k-primary`）导致侧边栏或其他部分显示异常。

## 实现步骤

### 1. 模板结构

在你的 Vue 组件模板中，使用一个 Wrapper `div` 包裹 `k-layout`。

```vue
<template>
  <!-- 外层 Wrapper，用于限定样式作用域 -->
  <div class="my-plugin-wrapper">
    <k-layout>
      <!-- 你的主内容区域 -->
      <div class="content-container">
        <!-- ... -->
      </div>
    </k-layout>
  </div>
</template>
```

### 2. 样式编写 (SCSS)

在 `<style scoped lang="scss">` 中编写如下样式：

```scss
<style scoped lang="scss">
.my-plugin-wrapper {
  /* 1. 定义你的主题变量 (可选，推荐) */
  --my-bg-color: #fffbeb;
  --my-text-color: #451a03;
  
  /* 2. 确保 Wrapper 填满父容器 */
  width: 100%;
  height: 100%;
  
  /* 3. 覆盖 k-layout 的背景 */
  :deep(.k-layout) {
    /* 强制背景色 */
    background-color: var(--my-bg-color) !important;
    
    /* (可选) 添加背景图片/纹理 */
    background-image: 
      radial-gradient(#fde68a 1px, transparent 1px),
      radial-gradient(#fde68a 1px, transparent 1px) !important;
    background-size: 20px 20px;
    background-position: 0 0, 10px 10px;
    
    /* 强制文字颜色 */
    color: var(--my-text-color);
  }

  /* 4. (可选) 如果只想覆盖内容区，保留侧边栏原样 */
  /* :deep(.k-layout__main) {
       background: ... !important;
     } 
  */
  
  /* 5. 处理内容区滚动和内边距 */
  .content-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 32px;
    height: 100%;
    overflow-y: auto; /* 确保内容可滚动 */
  }
}
</style>
```

### 3. 关键点解释

*   **:deep(.k-layout)**: 这是 Vue 的深度选择器。因为 `k-layout` 是一个组件，它的根元素在你的组件编译后会变成子节点，普通的类选择器无法选中。`:deep` 允许你的样式穿透到子组件内部。
*   **!important**: Koishi 的默认样式通常会设置 `background-color`。为了确保你的样式生效，特别是当 Koishi 主题切换（深/浅色）时，加上 `!important` 是最稳妥的方式。
*   **z-index**: 如果你发现背景遮挡了侧边栏，检查是否给 Wrapper 设置了 `position: absolute` 和过高的 `z-index`。通常情况下，**不要**给 Wrapper 设置 `position: fixed` 或 `absolute`，让它自然填充 `k-layout` 的插槽即可。

## 常见问题

**Q: 侧边栏不见了？**
A: 检查是否给 `.my-plugin-wrapper` 设置了 `position: fixed; top: 0; left: 0; z-index: 1000;`。这会使你的组件浮在所有内容之上，包括侧边栏。正确的做法是**不要脱离文档流**，或者确保 `z-index` 低于侧边栏（Koishi 侧边栏通常没有很高层级，或者你需要调整布局结构）。推荐直接利用 `k-layout` 的默认布局，只改背景色。

**Q: 文字颜色看不清？**
A: Koishi 会根据深/浅色模式自动调整 `--k-text` 颜色。如果你强制改了背景色（比如强制改为亮色背景），那么在深色模式下，Koishi 的白色文字就会看不清。解决方法是在 `:deep(.k-layout)` 中同时强制设置 `color` 属性。

```scss
:deep(.k-layout) {
  background: #fff !important;
  color: #333 !important; /* 强制文字颜色以适配你的背景 */
}
```
