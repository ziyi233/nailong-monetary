# 最终设计说明

## 核心设计原则

**主键使用 userId（平台ID），uid 作为可选辅助字段**

## 表结构

```typescript
interface Monetary {
  userId: string   // 主键：平台用户ID（如QQ号）
  uid?: number     // 可选：Koishi内部ID
  currency: string // 主键：货币类型
  value: number    // 货币数量
}
```

**主键**: `[userId, currency]`

## 设计理由

1. **向后兼容**: 你的旧数据使用 `userId` 作为主键，保持不变
2. **外部服务友好**: 外部服务可以直接用平台ID（QQ号）操作
3. **渐进增强**: 新增 `uid` 字段，逐步补充，不影响现有功能

## API 使用

### 方式1：推荐方式（Koishi插件内部）

使用 `costWithBoth` 和 `gainWithBoth`，同时维护 `uid` 和 `userId`：

```typescript
ctx.command('mycommand')
  .action(async ({ session }) => {
    // 同时传入 uid 和 userId
    await ctx.monetary.costWithBoth(
      session.user.id,    // uid (number)
      session.userId,     // userId (string)
      10,
      'default'
    )
  })
```

**优点**: 
- 自动补充旧数据的 `uid` 字段
- 同时维护两个索引
- 未来可以支持通过 `uid` 快速查询

### 方式2：兼容方式（外部服务/旧代码）

使用 `cost`、`gain`、`getBalance`，只通过 `userId` 操作：

```typescript
// 传入平台ID（推荐）
await ctx.monetary.cost('123456789', 10)  // QQ号
await ctx.monetary.gain('123456789', 100)
const balance = await ctx.monetary.getBalance('123456789')

// 传入数字也会被转换为 string
await ctx.monetary.cost(123456789, 10)  // 会转为 '123456789'
```

**注意**: 
- 参数会被统一转换为 `string` 类型
- 只通过 `userId` 查询，不使用 `uid`
- 不会自动补充 `uid` 字段

## 兼容性说明

### ✅ 完全兼容你的旧数据

- 旧数据: `{ userId: "QQ号", currency: "default", value: 100 }`
- 可以正常使用所有 API
- 不会丢失任何数据

### ⚠️ 不兼容原始 koishi monetary

原始 monetary 使用 `uid: number` 作为主键，而你的插件使用 `userId: string`。

如果其他插件期望调用原始 monetary 的接口：
```typescript
// 原始 monetary 的用法
await ctx.monetary.cost(session.user.id, 10)  // 传入 uid (number)
```

在你的插件中：
```typescript
// 会被转换为 string
await ctx.monetary.cost(session.user.id, 10)
// 实际查询: { userId: String(session.user.id), currency }
```

**这可能导致问题**，因为：
- `session.user.id` 是数字（如 `1`）
- 转换为 string 后是 `"1"`
- 但你的数据库中 `userId` 存储的是平台ID（如 `"onebot:123456789"`）
- 查询会失败！

## 解决方案

### 如果你的 userId 存储的是纯数字QQ号

那么没问题，`String(session.user.id)` 可能恰好匹配。

### 如果你的 userId 存储的是带平台前缀的ID

例如 `"onebot:123456789"`，那么：

**推荐做法**: 明确告知使用者，必须传入正确的 `userId` 格式：

```typescript
// 正确
await ctx.monetary.cost(session.userId, 10)  // "onebot:123456789"

// 错误
await ctx.monetary.cost(session.user.id, 10)  // 1 → "1"
```

## 总结

### 你的插件定位

**这不是原始 monetary 的替代品，而是一个增强版本**：

1. ✅ 支持通过平台ID直接操作（外部服务友好）
2. ✅ 可选支持 Koishi 内部 uid（通过 `costWithBoth`）
3. ✅ 完全兼容你自己的旧数据
4. ⚠️ 不完全兼容原始 monetary 接口

### 推荐使用方式

- **Koishi 插件**: 使用 `costWithBoth(session.user.id, session.userId, ...)`
- **外部服务**: 使用 `cost(platformUserId, ...)` 直接传平台ID
- **旧代码迁移**: 确认传入的是 `userId` 而不是 `uid`
