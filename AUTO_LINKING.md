# 自动关联机制说明

## 核心思想

在**尽可能多的情况下**自动关联 `uid` 和 `userId`，无需手动干预。

## 关联策略

### 1. 直接关联（最优）

通过 `costWithBoth` 和 `gainWithBoth` 方法，同时传入 `uid` 和 `userId`：

```typescript
await ctx.monetary.costWithBoth(session.user.id, session.userId, 10)
await ctx.monetary.gainWithBoth(session.user.id, session.userId, 100)
```

**效果**：
- 创建新记录时，同时存储 `uid` 和 `userId`
- 更新旧记录时，自动补充缺失的字段

### 2. 反向查询关联（智能）

当使用 `cost`、`gain`、`getBalance` 方法时，如果记录缺少某个字段，会尝试从**同一用户的其他货币记录**中查找：

```typescript
// 用户有两种货币：default 和 gold
// default 记录：{ uid: 1, userId: "onebot:123", currency: "default", value: 100 }
// gold 记录：{ uid: 1, currency: "gold", value: 50 }  // 缺少 userId

// 当操作 gold 货币时
await ctx.monetary.gain(1, 10, 'gold')

// 系统会：
// 1. 查询 gold 记录，发现缺少 userId
// 2. 查询该用户的其他货币记录（通过 uid=1）
// 3. 找到 default 记录，获取 userId = "onebot:123"
// 4. 更新 gold 记录，补充 userId
```

### 3. 指令级关联（用户触发）

在用户使用指令时自动关联：

#### 扣费指令（command/execute 钩子）
```typescript
// 用户执行任何有花费的指令
await ctx.monetary.costWithBoth(session.user.id, session.userId, cost)
// ✅ 自动关联
```

#### 余额查询指令
```typescript
// 用户查询余额
// 1. 先用 uid 查询
// 2. 如果查不到，用 userId 查询
// 3. 如果通过 userId 查到了，补充 uid
```

## 关联场景

### 场景1：新用户首次使用

```typescript
// 用户首次执行指令
await ctx.monetary.costWithBoth(1, "onebot:123", 10)

// 创建记录：
// { uid: 1, userId: "onebot:123", currency: "default", value: 0 }
// ✅ 同时有 uid 和 userId
```

### 场景2：旧数据（只有 userId）

```typescript
// 旧数据：{ userId: "onebot:123", currency: "default", value: 100 }

// 用户执行指令
await ctx.monetary.costWithBoth(1, "onebot:123", 10)

// 更新后：
// { uid: 1, userId: "onebot:123", currency: "default", value: 90 }
// ✅ 补充了 uid
```

### 场景3：其他插件创建的数据（只有 uid）

```typescript
// 其他插件创建：{ uid: 1, currency: "default", value: 100 }

// 用户执行指令
await ctx.monetary.costWithBoth(1, "onebot:123", 10)

// 更新后：
// { uid: 1, userId: "onebot:123", currency: "default", value: 90 }
// ✅ 补充了 userId
```

### 场景4：多货币自动关联

```typescript
// 用户有 default 货币（完整）
// { uid: 1, userId: "onebot:123", currency: "default", value: 100 }

// 其他插件给用户添加 gold 货币（只有 uid）
await ctx.monetary.gain(1, 50, 'gold')
// 创建：{ uid: 1, currency: "gold", value: 50 }

// 用户再次操作 gold
await ctx.monetary.gain(1, 10, 'gold')

// 系统会：
// 1. 查询 gold 记录，发现缺少 userId
// 2. 查询用户的其他货币（uid=1），找到 default 记录
// 3. 从 default 记录获取 userId = "onebot:123"
// 4. 更新 gold 记录
// 结果：{ uid: 1, userId: "onebot:123", currency: "gold", value: 60 }
// ✅ 自动关联成功
```

### 场景5：余额查询触发关联

```typescript
// 旧数据：{ userId: "onebot:123", currency: "default", value: 100 }

// 用户查询余额（传入 uid）
const balance = await ctx.monetary.getBalance(1, 'default')

// 系统会：
// 1. 用 uid=1 查询，查不到
// 2. 尝试反向查询：查找 userId 对应的其他货币记录
// 3. 如果找到，补充 uid
// ✅ 下次查询就能用 uid 直接查到了
```

## 关联时机总结

| 操作 | 关联方式 | 触发条件 |
|------|---------|---------|
| `costWithBoth` | 直接关联 | 总是 |
| `gainWithBoth` | 直接关联 | 总是 |
| `cost` | 无（只扣费） | - |
| `gain` | 反向查询 | 记录缺少字段时 |
| `getBalance` | 反向查询 | 记录缺少字段时 |
| 指令扣费 | 直接关联 | 用户执行指令时 |
| 余额查询指令 | 双向查询 | 用户查询余额时 |

## 优势

1. **渐进式迁移**：无需手动执行迁移脚本
2. **智能补充**：在操作过程中自动补充缺失字段
3. **跨货币关联**：利用同一用户的其他货币记录
4. **用户无感知**：完全自动，用户无需关心
5. **数据完整性**：随着使用，数据越来越完整

## 注意事项

1. **反向查询限制**：只能从同一用户的其他货币记录中查找
2. **首次创建**：如果是全新用户的首次记录，无法通过反向查询关联
3. **推荐做法**：在 Koishi 插件内部，优先使用 `costWithBoth` 和 `gainWithBoth`
4. **性能考虑**：反向查询会增加一次数据库查询，但只在缺少字段时触发

## 最佳实践

### Koishi 插件开发者

```typescript
// ✅ 推荐：使用 costWithBoth
await ctx.monetary.costWithBoth(
  session.user.id,
  session.userId,
  10
)

// ⚠️ 可用：使用 cost（会尝试反向查询）
await ctx.monetary.cost(session.user.id, 10)

// ❌ 不推荐：只传 userId（无法反向查询到 uid）
await ctx.monetary.cost(session.userId, 10)
```

### 外部服务

```typescript
// 如果只知道平台ID
await ctx.monetary.cost('onebot:123456', 10)

// 系统会尝试从其他货币记录中查找 uid 并补充
```

## 数据完整性保证

随着用户的使用，数据会越来越完整：

```
初始状态（旧数据）：
{ userId: "onebot:123", currency: "default", value: 100 }

↓ 用户执行指令

第一次操作后：
{ uid: 1, userId: "onebot:123", currency: "default", value: 90 }

↓ 用户获得新货币

新货币（其他插件）：
{ uid: 1, currency: "gold", value: 50 }

↓ 用户操作新货币

自动关联后：
{ uid: 1, userId: "onebot:123", currency: "gold", value: 60 }

✅ 所有记录都完整了！
```
