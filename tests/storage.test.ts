import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { createLearningStore, parseBackup } from '../src/lib/storage'
import type { Backup, LearningRecord } from '../src/types'

const stores: ReturnType<typeof createLearningStore>[] = []
const newStore = (name = crypto.randomUUID()) => {
  const store = createLearningStore(name)
  stores.push(store)
  return store
}
const record = (id: string, timestamp: string): LearningRecord => ({
  id,
  kind: 'question',
  mastery: 'uncertain',
  favorite: true,
  progress: 0,
  lastViewedAt: null,
  updatedAt: timestamp,
})
const backup = (records: LearningRecord[]): Backup => ({
  app: 'BetterSelf',
  schemaVersion: 1,
  exportedAt: '2026-10-22T00:00:00.000Z',
  records,
})
afterEach(async () => {
  await Promise.all(stores.splice(0).map((store) => store.close()))
})

describe('学习记录持久化和备份', () => {
  it('重新打开数据库仍保留记录，查看答案不自动改为已掌握', async () => {
    const name = crypto.randomUUID()
    const first = newStore(name)
    await first.update('q-first', 'question', { mastery: 'uncertain' })
    await first.update('q-first', 'question', { lastViewedAt: new Date().toISOString() })
    await first.close()
    const reopened = newStore(name)
    expect((await reopened.all())[0].mastery).toBe('uncertain')
  })
  it('同时修改不同字段时保留双方结果', async () => {
    const store = newStore()
    await Promise.all([
      store.update('q-first', 'question', { mastery: 'mastered' }),
      store.update('q-first', 'question', { favorite: true }),
    ])
    const saved = (await store.all())[0]
    expect(saved.favorite).toBe(true)
    expect(saved.mastery).toBe('mastered')
  })
  it('导出导入完整恢复掌握程度、收藏与阅读位置', async () => {
    const source = newStore()
    await source.update('article-one', 'article', {
      progress: 0.62,
      favorite: true,
      lastViewedAt: new Date().toISOString(),
    })
    await source.update('q-first', 'question', { mastery: 'unknown' })
    const destination = newStore()
    await destination.import(await source.export())
    expect(await destination.all()).toEqual(await source.all())
  })
  it('旧备份不会覆盖较新的记录，未知内容 ID 可保留用于后续恢复', async () => {
    const store = newStore()
    await store.import(backup([record('q-first', '2026-10-22T01:00:00.000Z')]))
    await store.import(
      backup([
        record('q-first', '2026-10-21T01:00:00.000Z'),
        record('future-question', '2026-10-22T02:00:00.000Z'),
      ]),
    )
    expect((await store.all()).find((item) => item.id === 'q-first')?.updatedAt).toBe(
      '2026-10-22T01:00:00.000Z',
    )
    expect((await store.all()).some((item) => item.id === 'future-question')).toBe(true)
  })
  it('包含一个坏记录时拒绝整份备份，保留原始数据库', async () => {
    const store = newStore()
    await store.update('q-original', 'question', { mastery: 'mastered' })
    const before = await store.all()
    const malformed = backup([
      record('q-valid', '2026-10-22T01:00:00.000Z'),
      { ...record('q-invalid', '2026-10-22T01:00:00.000Z'), progress: 3 },
    ])
    await expect(store.import(malformed)).rejects.toThrow('无效')
    expect(await store.all()).toEqual(before)
  })
  it('拒绝重复 ID、未来格式版本和破损 JSON', () => {
    const item = record('q-first', '2026-10-22T01:00:00.000Z')
    expect(() => parseBackup(JSON.stringify(backup([item, item])))).toThrow('重复')
    expect(() => parseBackup(JSON.stringify({ ...backup([]), schemaVersion: 2 }))).toThrow(
      '不受支持',
    )
    expect(() => parseBackup('{broken')).toThrow('JSON')
  })
})
