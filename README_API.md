# API 使用说明

## 智能参数识别

所有方法都支持智能参数识别：
- **传入 `number`** → 通过 `uid` 查询（Koishi 内部ID）
- **传入 `string`** → 通过 `userId` 查询（平台ID）

## 方法列表

### 1. cost - 扣除货币

```typescript
await ctx.monetary.cost(uidOrUserId, amount, currency?)
```

**参数**:
- `uidOrUserId`: `number | string` - 用户ID
  - `number`: Koishi 内部 uid（如 `session.user.id`）
  - `string`: 平台 userId（如 `session.userId` 或 `"onebot:123456"`）
- `amount`: `number` - 扣除金额
- `currency`: `string` - 货币类型（可选，默认 `'default'`）

**示例**:
```typescript
// 方式1：通过 uid（兼容原始 monetary）
await ctx.monetary.cost(session.user.id, 10)

// 方式2：通过 userId（平台ID）
await ctx.monetary.cost(session.userId, 10)
await ctx.monetary.cost('onebot:123456789', 10)
```

### 2. gain - 增加货币

```typescript
await ctx.monetary.gain(uidOrUserId, amount, currency?)
```

**参数**: 同 `cost`

**示例**:
```typescript
// 通过 uid
await ctx.monetary.gain(session.user.id, 100)

// 通过 userId
await ctx.monetary.gain(session.userId, 100)
```

### 3. getBalance - 查询余额

```typescript
const balance = await ctx.monetary.getBalance(uidOrUserId, currency?)
```

**返回**: `Promise<number>` - 余额（不存在返回 0）

**示例**:
```typescript
// 通过 uid
const balance1 = await ctx.monetary.getBalance(session.user.id)

// 通过 userId
const balance2 = await ctx.monetary.getBalance(session.userId)
```

### 4. transfer - 转账

```typescript
await ctx.monetary.transfer(fromUidOrUserId, toUidOrUserId, amount, currency?)
```

**参数**:
- `fromUidOrUserId`: 发送者ID（`number | string`）
- `toUidOrUserId`: 接收者ID（`number | string`）
- `amount`: 转账金额
- `currency`: 货币类型（可选）

**示例**:
```typescript
// uid 转给 uid
await ctx.monetary.transfer(session.user.id, targetUser.id, 50)

// userId 转给 userId
await ctx.monetary.transfer(session.userId, targetUserId, 50)

// 混合使用
await ctx.monetary.transfer(session.user.id, targetUserId, 50)
```

### 5. costWithBoth - 扣除货币（推荐）

```typescript
await ctx.monetary.costWithBoth(uid, userId, amount, currency?)
```

**特点**: 同时传入 `uid` 和 `userId`，会自动补充旧数据缺失的 `uid` 字段

**参数**:
- `uid`: `number` - Koishi 内部 uid
- `userId`: `string` - 平台 userId
- `amount`: `number` - 扣除金额
- `currency`: `string` - 货币类型（可选）

**示例**:
```typescript
await ctx.monetary.costWithBoth(
  session.user.id,    // uid
  session.userId,     // userId
  10,
  'default'
)
```

### 6. gainWithBoth - 增加货币（推荐）

```typescript
await ctx.monetary.gainWithBoth(uid, userId, amount, currency?)
```

**参数**: 同 `costWithBoth`

**示例**:
```typescript
await ctx.monetary.gainWithBoth(
  session.user.id,
  session.userId,
  100,
  'default'
)
```

## 使用建议

### Koishi 插件内部

**推荐使用 `costWithBoth` 和 `gainWithBoth`**，可以同时维护 `uid` 和 `userId`：

```typescript
ctx.command('mycommand')
  .action(async ({ session }) => {
    await ctx.monetary.costWithBoth(
      session.user.id,    // uid
      session.userId,     // userId
      10
    )
  })
```

### 外部服务

如果外部服务只知道平台ID，可以直接使用 `cost`、`gain`：

```typescript
// 传入平台ID（string）
await ctx.monetary.cost('onebot:123456789', 10)
const balance = await ctx.monetary.getBalance('onebot:123456789')
```

### 兼容原始 monetary

如果你的代码原本使用原始 monetary 插件：

```typescript
// 原始代码（传入 uid）
await ctx.monetary.cost(session.user.id, 10)
await ctx.monetary.gain(session.user.id, 100)
const balance = await ctx.monetary.getBalance(session.user.id)
```

**无需修改**，直接使用即可！插件会自动识别传入的是 `uid` (number)。

## 对接示例

### 示例1：图片生成插件

```typescript
// 扣除费用
if (config.monetaryCommands && ctx.monetary) {
  try {
    // 传入 session.user.id (uid)
    await ctx.monetary.cost(session.user.id, config.monetaryCost)
    
    // 获取余额
    const newBalance = await ctx.monetary.getBalance(session.user.id)
    
    await session.send(`已扣除 ${config.monetaryCost} 点数，剩余 ${newBalance}`)
  } catch (error) {
    await session.send("余额不足")
  }
}
```

### 示例2：签到插件

```typescript
ctx.command('sign')
  .action(async ({ session }) => {
    // 使用 gainWithBoth 同时维护两个字段
    await ctx.monetary.gainWithBoth(
      session.user.id,
      session.userId,
      10,
      'default'
    )
    
    const balance = await ctx.monetary.getBalance(session.user.id)
    return `签到成功！获得 10 点数，当前余额：${balance}`
  })
```

## 注意事项

1. **主键是 `userId`**: 表的主键是 `[userId, currency]`，不是 `uid`
2. **uid 可选**: `uid` 字段是可选的，旧数据可能没有
3. **自动补充**: 使用 `costWithBoth` 或 `gainWithBoth` 会自动补充缺失的 `uid`
4. **类型识别**: 根据参数类型自动选择查询字段（`number` → `uid`, `string` → `userId`）
5. **数据兼容**: 完全兼容旧数据，不会丢失任何信息
