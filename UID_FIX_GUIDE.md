# UID 补充方案说明

## 问题背景

`nailong-monetary` 插件使用 `userId`（平台ID，如 `platform:123456`）作为主键，`uid`（用户数字ID）作为可选字段。旧数据可能缺少 `uid` 字段。

## 已实现的解决方案

### 1. **balance 命令自动创建记录**

当用户查询余额时，如果记录不存在，会自动创建一条 `value=0` 的记录，同时保存 `userId` 和 `uid`。

```typescript
// 使用方法
.balance
.balance -c gold
```

**效果**：
- ✅ 维护了 `userId` 和 `uid` 的映射关系
- ✅ 用户首次查询即可建立完整记录
- ✅ 对用户透明，无需额外操作

### 2. **balance 命令自动补充 uid**

当查询到的记录缺少 `uid` 时，会自动补充：

```typescript
if (record && !record.uid) {
  await this.ctx.database.set('monetary', { 
    userId: session.userId, 
    currency 
  }, { uid: session.user.id })
}
```

### 3. **批量修复命令（管理员）**

新增 `monetary.fix-uid` 命令，用于批量补充历史数据的 `uid`：

```bash
# 修复所有货币的记录
monetary.fix-uid

# 只修复特定货币
monetary.fix-uid -c default

# 指定每次处理数量
monetary.fix-uid -l 50
```

**特性**：
- 权限要求：authority 4（管理员）
- 默认每次处理 100 条记录
- 显示成功/失败/剩余数量
- 可多次运行直到全部修复完成

## 技术细节

### userId vs uid 的关系

- **userId**: 平台复合ID，格式为 `platform:id`（如 `onebot:123456`）
- **uid**: Koishi 内部用户数字ID（`user.id`）

### 为什么不能直接通过 userId 查询 user 表？

Koishi 的 `user` 表主键是 `platform` + `id` 的组合，而 `userId` 是字符串格式的复合键。无法直接通过 `userId` 字符串查询到 `user.id`。

### 补充 uid 的三种方式

1. **通过 session**（最可靠）
   ```typescript
   session.user.id  // 直接获取 uid
   session.userId   // 获取 userId
   ```

2. **通过其他货币记录**（次优）
   ```typescript
   // 如果同一用户有多个货币记录，可以从其他记录获取
   const [otherRecord] = await ctx.database.get('monetary', { userId }, ['uid'])
   ```

3. **通过 user 表**（需要管理命令）
   ```typescript
   // 只能在批量处理时使用
   const [user] = await ctx.database.get('user', userId, ['id'])
   ```

## 使用建议

### 对于新用户
- 首次使用 `.balance` 命令即可自动创建完整记录
- 无需额外操作

### 对于旧数据
1. 让用户自然使用 `.balance` 命令（推荐）
   - 优点：无需管理员干预，自动修复
   - 缺点：需要用户主动查询

2. 管理员运行 `.monetary.fix-uid`（快速修复）
   - 优点：一次性批量修复所有记录
   - 缺点：需要管理员权限

## 代码改进点

### 修复前的问题

1. ❌ `getBalance` 返回 0 但不创建记录，无法维护映射关系
2. ❌ `getBalance` 中的 uid 补充逻辑是循环查询，无法成功
3. ❌ 没有批量修复工具

### 修复后的改进

1. ✅ `balance` 命令自动创建 0 余额记录
2. ✅ `balance` 命令自动补充缺失的 uid
3. ✅ 新增 `fix-uid` 管理命令批量修复
4. ✅ 所有 `gain`/`cost`/`transfer` 方法都会尝试补充 uid

## 测试建议

```bash
# 1. 测试新用户首次查询
.balance

# 2. 测试旧数据补充（需要先手动创建缺少 uid 的记录）
# 然后运行
.balance

# 3. 测试批量修复（管理员）
.monetary.fix-uid
```
