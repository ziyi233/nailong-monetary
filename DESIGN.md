# nailong-monetary 设计说明

## 表结构设计

### monetary 表字段

```typescript
interface Monetary {
  uid: number        // Koishi 内部用户ID（自增，来自 user 表）
  userId: string     // 平台用户ID（如QQ号）
  currency: string   // 货币类型
  value: number      // 货币数量
}
```

**主键**: `[uid, currency]`

### 为什么同时需要 uid 和 userId？

1. **uid (number)**: 
   - Koishi 内部的用户唯一标识
   - 来自 `session.user.id`
   - 用作主键，保证数据一致性
   - 兼容原始 monetary 插件接口

2. **userId (string)**:
   - 平台用户ID（如QQ号、Discord ID等）
   - 来自 `session.userId`
   - 方便外部服务直接通过平台ID操作数据
   - 支持跨平台场景

## API 设计

### 推荐方法（同时提供 uid 和 userId）

```typescript
// 扣费
await ctx.monetary.costWithBoth(session.user.id, session.userId, 10, 'default')

// 增加
await ctx.monetary.gainWithBoth(session.user.id, session.userId, 100, 'default')
```

### 兼容方法（只提供其中一个）

```typescript
// 使用 uid（推荐用于 Koishi 插件）
await ctx.monetary.cost(session.user.id, 10)
await ctx.monetary.gain(session.user.id, 100)
await ctx.monetary.getBalance(session.user.id)

// 使用 userId（用于外部服务）
await ctx.monetary.cost('123456789', 10)  // QQ号
await ctx.monetary.getBalance('123456789')
```

## 数据一致性

### uid 和 userId 的映射

- **插入时**: 使用 `costWithBoth` 或 `gainWithBoth` 方法，同时提供 uid 和 userId
- **查询时**: 可以通过 uid 或 userId 任意一个查询
- **更新时**: 如果记录中 userId 为空，会自动补充

### 为什么不查询 user 表？

Koishi 的 `user` 表结构比较复杂，且平台ID的存储方式可能因版本而异。
直接在 monetary 表中同时存储 uid 和 userId 更简单可靠。

## 使用场景

### 场景1：Koishi 插件内部使用

```typescript
ctx.command('mycommand')
  .action(async ({ session }) => {
    // 从 session 同时获取 uid 和 userId
    await ctx.monetary.costWithBoth(
      session.user.id,    // uid
      session.userId,     // userId
      10,
      'default'
    )
  })
```

### 场景2：外部服务通过平台ID操作

```typescript
// 外部服务只知道QQ号
const qqNumber = '123456789'

// 查询余额
const balance = await ctx.monetary.getBalance(qqNumber)

// 扣费（需要确保记录已存在）
await ctx.monetary.cost(qqNumber, 10)
```

### 场景3：数据迁移

如果你有旧数据只有 uid，可以通过 session 补充 userId：

```typescript
// 在用户下次使用时自动补充 userId
ctx.before('command/execute', async (argv) => {
  const { session } = argv
  // costWithBoth 会自动补充缺失的 userId
  await ctx.monetary.costWithBoth(
    session.user.id,
    session.userId,
    0,  // 不扣费，只是为了补充 userId
    'default'
  )
})
```

## 注意事项

1. **新记录创建**: 推荐使用 `gainWithBoth` 或 `costWithBoth`，确保同时存储 uid 和 userId
2. **外部服务**: 如果外部服务只知道 userId，确保该用户的 monetary 记录已存在
3. **主键选择**: 使用 uid 作为主键，因为它是数字类型，性能更好且唯一
4. **数据一致性**: userId 字段可以为空（旧数据），但 uid 必须存在

## 兼容性

- ✅ 完全兼容原始 monetary 插件（使用 uid）
- ✅ 支持外部服务通过平台ID操作
- ✅ 自动补充缺失的 userId 字段
- ✅ 支持多货币类型
