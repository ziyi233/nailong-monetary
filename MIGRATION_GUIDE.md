# 迁移指南

## 概述

本插件实现了与原始 koishi monetary 插件的向后兼容，同时使用新的表结构。

## 关键变更

### 表结构
- **字段名变更**: `uid` (number) → `userId` (string)
- **主键**: `[userId, currency]`

### 接口兼容性
所有公共方法都支持 `number | string` 类型的用户ID参数：

```typescript
// 方法签名
cost(uid: number | string, cost?: number, currency?: string): Promise<void>
gain(uid: number | string, gain: number, currency?: string): Promise<void>
transfer(fromUid: number | string, toUid: number | string, amount: number, currency?: string): Promise<void>
getBalance(uid: number | string, currency?: string): Promise<number>
```

## 使用示例

### 老插件调用方式（仍然支持）

```typescript
// 使用 number 类型的用户ID
await ctx.monetary.cost(123456, 10)
await ctx.monetary.gain(123456, 100)
const balance = await ctx.monetary.getBalance(123456)
```

### 新插件调用方式（推荐）

```typescript
// 使用 string 类型的用户ID
await ctx.monetary.cost('123456', 10)
await ctx.monetary.gain('123456', 100)
const balance = await ctx.monetary.getBalance('123456')
```

## 数据迁移

### 自动转换
插件会自动将传入的 `number` 类型用户ID转换为 `string` 类型存储到数据库。

### 手动迁移现有数据
如果你的数据库中已有使用 `uid: number` 的旧数据，需要执行数据迁移：

```sql
-- SQLite 示例
-- 1. 创建新表
CREATE TABLE monetary_new (
  userId TEXT NOT NULL,
  currency TEXT NOT NULL,
  value INTEGER NOT NULL,
  PRIMARY KEY (userId, currency)
);

-- 2. 迁移数据
INSERT INTO monetary_new (userId, currency, value)
SELECT CAST(uid AS TEXT), currency, value FROM monetary;

-- 3. 删除旧表并重命名
DROP TABLE monetary;
ALTER TABLE monetary_new RENAME TO monetary;
```

## 注意事项

1. **类型安全**: TypeScript 会自动检查类型，确保传入的参数正确
2. **性能**: 类型转换开销极小，不会影响性能
3. **兼容性**: 其他插件无需修改，可以继续使用 `number` 类型的用户ID
4. **新功能**: 支持多货币类型和转账功能

## 新增功能

### 多货币支持
```typescript
// 指定货币类型
await ctx.monetary.cost(userId, 10, 'gold')
await ctx.monetary.gain(userId, 100, 'diamond')
```

### 转账功能
```typescript
// 用户之间转账
await ctx.monetary.transfer(fromUserId, toUserId, 50, 'default')
```

### 指令级货币配置
```typescript
ctx.command('mycommand')
  .option('cost', 10)
  .option('costCurrency', 'gold')
```

## 常见问题

### Q: 我的其他插件还在使用 number 类型的 uid，会有问题吗？
A: 不会。本插件完全兼容老接口，会自动转换类型。

### Q: 我需要修改现有代码吗？
A: 不需要。现有代码可以继续使用，但建议新代码使用 string 类型。

### Q: 表结构改变后，旧数据怎么办？
A: 需要执行数据迁移SQL，将 uid 字段转换为 userId 字段。

### Q: 为什么要改成 string 类型？
A: 为了支持更灵活的用户ID格式，例如平台ID、UUID等。
