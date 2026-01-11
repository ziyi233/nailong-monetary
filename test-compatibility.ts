/**
 * 兼容性测试示例
 * 
 * 此文件演示了新插件如何同时支持老接口（number）和新接口（string）
 */

import { Context } from 'koishi'

export async function testCompatibility(ctx: Context) {
  // ============ 老接口测试（使用 number 类型的 uid） ============
  
  const oldUid = 123456
  
  // 测试 cost 方法
  await ctx.monetary.cost(oldUid, 10, 'default')
  console.log('✓ 老接口 cost 方法测试通过')
  
  // 测试 gain 方法
  await ctx.monetary.gain(oldUid, 100, 'default')
  console.log('✓ 老接口 gain 方法测试通过')
  
  // 测试 getBalance 方法
  const oldBalance = await ctx.monetary.getBalance(oldUid, 'default')
  console.log(`✓ 老接口 getBalance 方法测试通过，余额: ${oldBalance}`)
  
  // 测试 transfer 方法
  await ctx.monetary.transfer(oldUid, 789012, 50, 'default')
  console.log('✓ 老接口 transfer 方法测试通过')
  
  
  // ============ 新接口测试（使用 string 类型的 userId） ============
  
  const newUserId = '123456'
  
  // 测试 cost 方法
  await ctx.monetary.cost(newUserId, 10, 'default')
  console.log('✓ 新接口 cost 方法测试通过')
  
  // 测试 gain 方法
  await ctx.monetary.gain(newUserId, 100, 'default')
  console.log('✓ 新接口 gain 方法测试通过')
  
  // 测试 getBalance 方法
  const newBalance = await ctx.monetary.getBalance(newUserId, 'default')
  console.log(`✓ 新接口 getBalance 方法测试通过，余额: ${newBalance}`)
  
  // 测试 transfer 方法
  await ctx.monetary.transfer(newUserId, '789012', 50, 'default')
  console.log('✓ 新接口 transfer 方法测试通过')
  
  
  // ============ 混合使用测试 ============
  
  // number 转给 string
  await ctx.monetary.transfer(123456, '789012', 10, 'default')
  console.log('✓ 混合接口测试通过（number → string）')
  
  // string 转给 number
  await ctx.monetary.transfer('123456', 789012, 10, 'default')
  console.log('✓ 混合接口测试通过（string → number）')
  
  
  console.log('\n所有兼容性测试通过！✓')
}

/**
 * 模拟老插件的调用方式
 */
export async function simulateOldPlugin(ctx: Context) {
  // 老插件通常这样调用
  const userId = 123456 // number 类型
  
  // 扣费
  try {
    await ctx.monetary.cost(userId, 10)
  } catch (e) {
    console.log('余额不足')
  }
  
  // 增加
  await ctx.monetary.gain(userId, 100)
  
  // 查询
  const balance = await ctx.monetary.getBalance(userId)
  console.log(`当前余额: ${balance}`)
}

/**
 * 新插件的推荐调用方式
 */
export async function recommendedUsage(ctx: Context, session: any) {
  // 新插件推荐使用 string 类型
  const userId = session.userId // string 类型
  
  // 扣费（支持多货币）
  try {
    await ctx.monetary.cost(userId, 10, 'gold')
  } catch (e) {
    console.log('余额不足')
  }
  
  // 增加
  await ctx.monetary.gain(userId, 100, 'gold')
  
  // 查询
  const balance = await ctx.monetary.getBalance(userId, 'gold')
  console.log(`当前金币余额: ${balance}`)
  
  // 转账
  await ctx.monetary.transfer(userId, 'target-user-id', 50, 'gold')
}
