# 修改总结

## 问题

你的 `nailong-monetary` 插件表结构使用了 `userId: string`（平台ID），但原始 monetary 使用 `uid: number`（Koishi内部ID），导致接口不兼容。

## 解决方案

**同时存储 uid 和 userId 两个字段**

### 表结构

```typescript
interface Monetary {
  uid: number        // Koishi 内部ID（主键）
  userId: string     // 平台ID（如QQ号）
  currency: string   // 货币类型
  value: number      // 货币数量
}
```

主键: `[uid, currency]`

### uid 和 userId 的映射关系

**不需要查询其他表！**

在 Koishi 中，session 对象同时提供了这两个值：
- `session.user.id` → uid (number)
- `session.userId` → userId (string)

所以在创建 monetary 记录时，直接从 session 同时获取并存储即可。

## 实现的方法

### 1. 新增推荐方法

```typescript
// 同时提供 uid 和 userId
async costWithBoth(uid: number, userId: string, cost: number, currency?: string)
async gainWithBoth(uid: number, userId: string, gain: number, currency?: string)
```

### 2. 兼容老接口

```typescript
// 支持只传 uid 或 userId
async cost(uidOrUserId: number | string, cost: number, currency?: string)
async gain(uidOrUserId: number | string, gain: number, currency?: string)
async getBalance(uidOrUserId: number | string, currency?: string)
async transfer(from: number | string, to: number | string, amount: number, currency?: string)
```

## 使用方式

### Koishi 插件内部（推荐）

```typescript
ctx.command('mycommand')
  .action(async ({ session }) => {
    // 使用 costWithBoth，同时传递 uid 和 userId
    await ctx.monetary.costWithBoth(
      session.user.id,    // uid
      session.userId,     // userId  
      10
    )
  })
```

### 外部服务（通过平台ID）

```typescript
// 只知道QQ号
await ctx.monetary.cost('123456789', 10)
await ctx.monetary.getBalance('123456789')
```

### 老插件（通过 uid）

```typescript
// 完全兼容
await ctx.monetary.cost(session.user.id, 10)
await ctx.monetary.gain(session.user.id, 100)
```

## 关键修改

1. **表结构**: 添加了 `uid: number` 字段，主键改为 `[uid, currency]`
2. **command/execute 钩子**: 改用 `session.user.id` 而不是 `session.userId`
3. **profile 注册**: 改用 `session.user.id` 查询
4. **新增方法**: `costWithBoth` 和 `gainWithBoth`，推荐使用
5. **兼容方法**: `cost`、`gain`、`getBalance`、`transfer` 支持 `number | string` 参数

## 优势

✅ 完全兼容原始 monetary 接口（使用 uid）
✅ 支持外部服务通过平台ID直接操作
✅ 不需要查询 user 表，性能更好
✅ 数据结构清晰，uid 和 userId 直接存储在同一张表
✅ 支持多货币类型和转账功能

## 文档

- `DESIGN.md` - 详细设计说明
- `COMPATIBILITY.md` - 兼容性说明（需要更新）
- `MIGRATION_GUIDE.md` - 数据迁移指南（需要更新）
