# 数据迁移说明

## 问题

旧版本的表结构：
```typescript
{
  userId: string,   // 主键
  currency: string, // 主键
  value: number
}
```

新版本的表结构：
```typescript
{
  userId: string,   // 主键
  uid?: number,     // 新增字段（可选）
  currency: string, // 主键
  value: number
}
```

## 好消息：不会丢失数据！

### 设计保证

1. **主键未变**: 仍然使用 `[userId, currency]` 作为主键
2. **uid 可选**: `uid` 字段设置为可选（nullable），旧数据可以没有这个字段
3. **自动补充**: 当用户下次使用时，会自动补充 `uid` 字段

### 自动迁移机制

插件会在以下情况自动补充 `uid`：

1. **用户使用指令时**: 通过 `costWithBoth` 方法自动补充
2. **增加货币时**: 通过 `gainWithBoth` 方法自动补充
3. **扣除货币时**: 通过 `costWithBoth` 方法自动补充

## 迁移过程

### 更新插件后

```
旧数据: { userId: "123456", currency: "default", value: 100 }
        ↓ (用户使用指令)
新数据: { userId: "123456", uid: 1, currency: "default", value: 90 }
```

### 代码示例

```typescript
// 用户执行指令，自动补充 uid
ctx.command('test')
  .action(async ({ session }) => {
    // costWithBoth 会检查记录是否有 uid
    // 如果没有，自动补充 session.user.id
    await ctx.monetary.costWithBoth(
      session.user.id,  // uid
      session.userId,   // userId
      10,
      'default'
    )
  })
```

## 兼容性

### ✅ 完全兼容

- 旧数据可以正常读取
- 旧数据可以正常更新
- 旧数据会逐步补充 uid 字段
- 不需要手动执行任何迁移脚本

### 查询方式

```typescript
// 方式1：通过 userId 查询（兼容旧数据）
await ctx.monetary.cost('123456', 10)

// 方式2：通过 uid 查询（需要数据已有 uid）
await ctx.monetary.cost(1, 10)

// 方式3：同时提供（推荐，会自动补充）
await ctx.monetary.costWithBoth(1, '123456', 10)
```

## 手动迁移（可选）

如果你想一次性为所有旧数据补充 uid，可以执行以下脚本：

```typescript
// 注意：这需要你能够从 userId 获取对应的 uid
// 通常不需要手动执行，让系统自动补充即可

async function migrateData(ctx: Context) {
  const records = await ctx.database.get('monetary', {})
  
  for (const record of records) {
    if (!record.uid) {
      // 需要通过某种方式获取 userId 对应的 uid
      // 例如：查询 user 表或 binding 表
      // 这里只是示例，实际实现取决于你的系统
      
      // const [user] = await ctx.database.get('user', { id: record.userId })
      // if (user) {
      //   await ctx.database.set('monetary', 
      //     { userId: record.userId, currency: record.currency },
      //     { uid: user.id }
      //   )
      // }
    }
  }
}
```

## 总结

✅ **不会丢失数据** - 主键未变，旧数据完全保留
✅ **自动迁移** - 用户使用时自动补充 uid
✅ **无需操作** - 更新插件后直接使用即可
✅ **渐进式** - 数据会逐步完善，不影响使用

**建议**: 直接更新插件，让系统自动补充 uid 字段，无需手动干预。
