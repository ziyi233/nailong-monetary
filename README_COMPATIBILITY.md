# nailong-monetary 兼容性说明

## 快速概览

本插件完全兼容原始 koishi monetary 插件的接口，同时使用新的表结构。

### 核心变更
- 表字段: `uid: number` → `userId: string`
- 接口参数: 支持 `number | string` 类型

### 兼容性保证
✅ 老插件可以继续使用 `number` 类型的用户ID
✅ 新插件推荐使用 `string` 类型的用户ID
✅ 自动类型转换，无性能损失
✅ 完全向后兼容

## 方法签名对比

### 原始接口
```typescript
cost(uid: number, cost: number, currency?: string): Promise<void>
gain(uid: number, gain: number, currency?: string): Promise<void>
```

### 新接口（兼容）
```typescript
cost(uid: number | string, cost: number, currency?: string): Promise<void>
gain(uid: number | string, gain: number, currency?: string): Promise<void>
transfer(fromUid: number | string, toUid: number | string, amount: number, currency?: string): Promise<void>
getBalance(uid: number | string, currency?: string): Promise<number>
```

## 使用示例

### 老代码（无需修改）
```typescript
// 这些代码可以继续正常工作
await ctx.monetary.cost(123456, 10)
await ctx.monetary.gain(123456, 100)
```

### 新代码（推荐）
```typescript
// 推荐使用 string 类型
await ctx.monetary.cost(session.userId, 10)
await ctx.monetary.gain(session.userId, 100)
```

## 新增功能

1. **多货币支持**: 可以在指令级别配置不同的货币类型
2. **转账功能**: 用户之间可以互相转账
3. **余额查询**: 提供便捷的余额查询指令
4. **自定义消息**: 可配置扣费成功和余额不足的提示消息

## 数据迁移

如果你有旧数据需要迁移，请参考 `MIGRATION_GUIDE.md`。

## 文档

- `COMPATIBILITY.md` - 详细的兼容性说明
- `MIGRATION_GUIDE.md` - 数据迁移指南
- `test-compatibility.ts` - 兼容性测试示例

## 总结

你不需要修改任何现有代码，插件会自动处理类型转换。新代码建议使用 `string` 类型的用户ID以获得更好的灵活性。
