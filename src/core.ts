import { $, Context } from 'koishi'

/** 货币记录类型 */
export type MonetaryRecord = { userId: string; uid?: number; currency: string; value: number }

/**
 * 货币服务核心类
 * 提供基于 uid 的货币操作 API
 */
export class MonetaryCore {
  constructor(private ctx: Context) {}

  /**
   * 从 userId 提取纯平台 ID（去掉 platform: 前缀）
   */
  extractPid(userId: string): string {
    const idx = userId.lastIndexOf(':')
    return idx >= 0 ? userId.slice(idx + 1) : userId
  }

  /**
   * 通过 binding 表查找用户的 uid
   */
  async getUidByPid(pid: string, platform?: string): Promise<number | null> {
    // 如果提供了 platform，先尝试 getUser
    if (platform) {
      try {
        const user = await this.ctx.database.getUser(platform, pid, ['id'])
        if (user?.id) return user.id
      } catch {
        // ignore
      }
    }

    // 尝试直接通过 pid 查找 binding
    const [binding] = await this.ctx.database.get('binding', { pid }, ['aid'])
    if (binding?.aid) return binding.aid

    // 尝试用纯 ID 查找
    const pureId = this.extractPid(pid)
    if (pureId !== pid) {
      const [binding2] = await this.ctx.database.get('binding', { pid: pureId }, ['aid'])
      if (binding2?.aid) return binding2.aid
    }

    return null
  }

  /**
   * 获取用户 uid，如果不存在则自动创建（用于充值场景）
   * @param pid 平台用户ID（如QQ号）
   * @param platform 平台名称，默认 'onebot'
   * @returns uid
   */
  async getOrCreateUidByPid(pid: string, platform: string = 'onebot'): Promise<number> {
    const pureId = this.extractPid(pid)

    // 先尝试查找现有的 uid
    const existingUid = await this.getUidByPid(pureId, platform)
    if (existingUid) {
      return existingUid
    }

    // 不存在则创建新用户
    this.ctx.logger.info(`为 ${platform}:${pureId} 创建新用户`)
    const user = await this.ctx.database.createUser(platform, pureId, {
      authority: 1,
    })

    return user.id
  }

  /**
   * 通过 uid 查找货币记录
   * 会尝试多种 userId 格式进行匹配
   */
  async findRecordByUid(
    uid: number,
    currency: string
  ): Promise<{ record: MonetaryRecord | null; userId: string | null }> {
    // 1. 先通过 uid 直接查找（最快路径）
    const [byUid] = await this.ctx.database.get('monetary', { uid, currency }, ['userId', 'uid', 'currency', 'value'])
    if (byUid) {
      return { record: byUid, userId: byUid.userId }
    }

    // 2. 通过 binding 表查找该用户的所有绑定
    const bindings = await this.ctx.database.get('binding', { aid: uid }, ['pid', 'platform'])
    if (bindings.length === 0) {
      return { record: null, userId: null }
    }

    // 3. 收集所有可能的 userId 变体
    const possibleUserIds = new Set<string>()
    for (const binding of bindings) {
      possibleUserIds.add(binding.pid)
      const pureId = this.extractPid(binding.pid)
      possibleUserIds.add(pureId)
      if (binding.platform) {
        possibleUserIds.add(`${binding.platform}:${pureId}`)
      }
    }

    // 4. 尝试每个可能的 userId
    for (const userId of possibleUserIds) {
      const [record] = await this.ctx.database.get('monetary', { userId, currency }, ['userId', 'uid', 'currency', 'value'])
      if (record) {
        // 找到记录，同步更新 uid 字段
        if (!record.uid) {
          await this.ctx.database.set('monetary', { userId, currency }, { uid })
        }
        return { record: { ...record, uid }, userId }
      }
    }

    // 5. 没找到记录，返回第一个 binding 的纯 pid 供创建新记录使用
    const firstPid = this.extractPid(bindings[0].pid)
    return { record: null, userId: firstPid }
  }

  /**
   * 获取用户显示名称
   */
  async getUserDisplayName(uid: number): Promise<string | null> {
    try {
      const [user] = await this.ctx.database.get('user', { id: uid }, ['name'])
      return user?.name ?? null
    } catch {
      return null
    }
  }

  /**
   * 获取余额
   */
  async getBalance(uid: number, currency: string = 'default'): Promise<number> {
    const { record } = await this.findRecordByUid(uid, currency)
    return record?.value ?? 0
  }

  /**
   * 通过 userId 直接获取余额（用于充值查询）
   */
  async getBalanceByUserId(userId: string, currency: string = 'default'): Promise<number> {
    const pureId = this.extractPid(userId)

    // 尝试多种格式
    for (const id of [userId, pureId]) {
      const [record] = await this.ctx.database.get('monetary', { userId: id, currency }, ['value'])
      if (record) return record.value
    }

    return 0
  }

  /**
   * 增加货币（基于 uid）
   */
  async gain(uid: number, amount: number, currency: string = 'default'): Promise<void> {
    if (amount < 0) throw new Error('金额不能为负数')

    const { record, userId } = await this.findRecordByUid(uid, currency)

    if (record) {
      await this.ctx.database.set(
        'monetary',
        { userId: record.userId, currency },
        (row) => ({ value: $.add(row.value, amount) })
      )
    } else {
      if (!userId) {
        throw new Error('找不到用户的 userId，无法创建记录')
      }
      await this.ctx.database.create('monetary', {
        userId,
        uid,
        currency,
        value: amount,
      })
    }
  }

  /**
   * 增加货币（基于 userId，用于充值）
   * 如果能找到 uid 会自动填充
   */
  async gainByUserId(userId: string, amount: number, currency: string = 'default'): Promise<void> {
    if (amount < 0) throw new Error('金额不能为负数')

    const pureId = this.extractPid(userId)

    // 尝试获取 uid
    const uid = await this.getUidByPid(pureId)

    // 查找现有记录
    const [existing] = await this.ctx.database.get('monetary', { userId: pureId, currency })

    if (existing) {
      // 更新现有记录
      const updates: any = {}
      if (uid && !existing.uid) {
        updates.uid = uid
      }
      await this.ctx.database.set(
        'monetary',
        { userId: pureId, currency },
        (row) => ({ value: $.add(row.value, amount), ...updates })
      )
    } else {
      // 创建新记录
      await this.ctx.database.create('monetary', {
        userId: pureId,
        uid: uid ?? undefined,
        currency,
        value: amount,
      })
    }
  }

  /**
   * 扣除货币
   */
  async cost(uid: number, amount: number, currency: string = 'default'): Promise<void> {
    if (amount < 0) throw new Error('金额不能为负数')

    const { record } = await this.findRecordByUid(uid, currency)

    if (!record) throw new Error('insufficient balance')
    if (record.value < amount) throw new Error('insufficient balance')

    await this.ctx.database.set(
      'monetary',
      { userId: record.userId, currency },
      (row) => ({ value: $.sub(row.value, amount) })
    )
  }

  /**
   * 转账
   */
  async transfer(fromUid: number, toUid: number, amount: number, currency: string = 'default'): Promise<void> {
    if (amount <= 0) throw new Error('转账金额必须大于0')
    if (fromUid === toUid) throw new Error('不能给自己转账')

    const balance = await this.getBalance(fromUid, currency)
    if (balance < amount) throw new Error('余额不足')

    await this.cost(fromUid, amount, currency)
    await this.gain(toUid, amount, currency)
  }
}
