import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { openDB } from 'idb'
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
  reviewState: 'active',
  updatedAt: timestamp,
})
const backup = (records: LearningRecord[]): Backup => ({
  app: 'BetterSelf',
  schemaVersion: 3,
  exportedAt: '2026-10-22T00:00:00.000Z',
  records,
  planRecords: [],
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
    expect(() => parseBackup(JSON.stringify({ ...backup([]), schemaVersion: 4 }))).toThrow(
      '不受支持',
    )
    expect(() => parseBackup('{broken')).toThrow('JSON')
  })
  it('旧备份保留自评与收藏，普通笔记不会因阅读收藏进入复习', () => {
    const legacyQuestion = record('q-legacy', '2026-10-22T00:00:00.000Z')
    const { reviewState: _, ...legacy } = legacyQuestion
    const result = parseBackup(
      JSON.stringify({
        ...backup([]),
        schemaVersion: 1,
        records: [
          legacy,
          { ...legacy, id: 'note-legacy', kind: 'article', mastery: null, progress: 0.7 },
        ],
      }),
    )
    expect(result.schemaVersion).toBe(3)
    expect(result.records[0].reviewState).toBe('active')
    expect(result.records[1]).toMatchObject({ favorite: true, progress: 0.7, reviewState: 'none' })
  })
  it('升级读取现有数据库，保存复习状态后不会再次按旧自评加入', async () => {
    const name = crypto.randomUUID()
    const store = newStore(name)
    await store.all()
    const db = await openDB(name)
    const { reviewState: _, ...legacy } = record('q-legacy', '2026-10-22T00:00:00.000Z')
    await db.put('records', legacy)
    db.close()
    expect((await store.all())[0].reviewState).toBe('active')
    await store.update('q-legacy', 'question', { reviewState: 'none' })
    await store.update('q-legacy', 'question', { favorite: false })
    expect((await store.all())[0]).toMatchObject({ mastery: 'uncertain', reviewState: 'none' })
  })
  it('笔记的收藏、阅读与复习独立，完成状态可经备份恢复', async () => {
    const store = newStore()
    await store.update('note-first', 'article', { favorite: true, progress: 0.4 })
    expect((await store.all())[0].reviewState).toBe('none')
    await store.update('note-first', 'article', { reviewState: 'active' })
    await store.update('note-first', 'article', { reviewState: 'completed' })
    const restored = newStore()
    await restored.import(await store.export())
    expect((await restored.all())[0]).toMatchObject({
      favorite: true,
      progress: 0.4,
      reviewState: 'completed',
    })
  })
  it('题目薄弱自评加入复习，查看答案不改变复习，掌握后完成', async () => {
    const store = newStore()
    await store.update('q-first', 'question', { mastery: 'unknown' })
    await store.update('q-first', 'question', { lastViewedAt: new Date().toISOString() })
    expect((await store.all())[0].reviewState).toBe('active')
    await store.update('q-first', 'question', { mastery: 'mastered' })
    expect((await store.all())[0].reviewState).toBe('completed')
  })
  it('新格式缺少或伪造复习状态时拒绝整份导入', () => {
    const item = record('q-first', '2026-10-22T00:00:00.000Z')
    expect(() =>
      parseBackup(
        JSON.stringify(
          backup([{ ...item, reviewState: 'unexpected' } as unknown as LearningRecord]),
        ),
      ),
    ).toThrow('无效')
    const { reviewState: _, ...missing } = item
    expect(() => parseBackup(JSON.stringify({ ...backup([]), records: [missing] }))).toThrow('无效')
  })
})
