# 兼容性说明

## 表结构变更

本插件对原始 monetary 表结构进行了修改：

- 原始表结构: uid: number (用户ID为数字类型)
- 新表结构: userId: string (用户ID为字符串类型)

## 接口兼容性

为了保持向后兼容，所有公共方法都支持 number 和 string 类型的用户ID。

### cost 方法
扣除用户货币，支持 number 或 string 类型的用户ID。

老接口调用: await ctx.monetary.cost(123456, 10, 'default')
新接口调用: await ctx.monetary.cost('123456', 10, 'default')

### gain 方法
增加用户货币，支持 number 或 string 类型的用户ID。

老接口调用: await ctx.monetary.gain(123456, 100, 'default')
新接口调用: await ctx.monetary.gain('123456', 100, 'default')

### getBalance 方法
查询用户货币余额，支持 number 或 string 类型的用户ID。

老接口调用: const balance = await ctx.monetary.getBalance(123456, 'default')
新接口调用: const balance = await ctx.monetary.getBalance('123456', 'default')

### transfer 方法
转账功能，支持 string 类型的用户ID。

调用示例: await ctx.monetary.transfer('123456', '789012', 50, 'default')

## 数据迁移

如果你的数据库中已有使用 number 类型 uid 的数据，需要进行数据迁移。
插件会自动将传入的 number 类型 uid 转换为 string 类型存储。

## 注意事项

1. 表结构使用 userId (string) 作为主键
2. 所有方法内部会自动将 number 类型的 uid 转换为 string
3. 其他插件可以继续使用老接口传入 number 类型的用户ID
4. 建议新代码使用 string 类型的 userId
