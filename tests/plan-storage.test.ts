import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { openDB } from 'idb'
import { reactive } from 'vue'
import { createLearningStore, parseBackup } from '../src/lib/storage'
import { planCases, planTasks } from '../src/lib/plan'
import { articles, projects, questions } from '../src/lib/content'
import type { Backup, PlanRecord } from '../src/types'

const stores: ReturnType<typeof createLearningStore>[] = []
function newStore(name = crypto.randomUUID()) {
  const store = createLearningStore(name)
  stores.push(store)
  return store
}
const planRecord = (updatedAt = '2026-10-25T01:00:00.000Z'): PlanRecord => ({
  id: 'unity-case-gameplay',
  kind: 'case',
  status: 'active',
  notes: '职责：玩法迭代\n验证：三个边界场景',
  articleIds: ['csharp-memory-basics'],
  questionIds: ['q-coroutines'],
  updatedAt,
})
const backup = (planRecords: PlanRecord[]): Backup => ({
  app: 'BetterSelf',
  schemaVersion: 3,
  exportedAt: '2026-10-25T01:00:00.000Z',
  records: [],
  planRecords,
})
afterEach(async () => {
  await Promise.all(stores.splice(0).map((store) => store.close()))
})

describe('计划、案例与历史记录共同保存', () => {
  it('界面传入响应式关联数组时仍可序列化到 IndexedDB', async () => {
    const store = newStore()
    const draft = reactive({ articleIds: ['csharp-memory-basics'], questionIds: ['q-coroutines'] })
    await store.updatePlan('unity-week-01', 'task', { ...draft, notes: '界面草稿' })
    expect((await store.allPlan())[0]).toMatchObject({ ...draft, notes: '界面草稿' })
  })
  it('升级旧数据库保留学习记录，并可保存新的计划记录', async () => {
    const name = crypto.randomUUID()
    const old = await openDB(name, 1, {
      upgrade(db) {
        db.createObjectStore('records', { keyPath: 'id' })
      },
    })
    await old.put('records', {
      id: 'old-note',
      kind: 'article',
      mastery: null,
      favorite: true,
      progress: 0.6,
      lastViewedAt: null,
      reviewState: 'active',
      updatedAt: '2026-10-22T01:00:00.000Z',
    })
    old.close()
    const store = newStore(name)
    expect((await store.all())[0]).toMatchObject({ id: 'old-note', favorite: true, progress: 0.6 })
    expect(await store.allPlan()).toEqual([])
    await store.updatePlan('unity-week-01', 'task', { status: 'active', notes: '职责清单' })
    expect((await store.allPlan())[0]).toMatchObject({ notes: '职责清单', status: 'active' })
    expect((await store.all())[0]?.reviewState).toBe('active')
  })
  it('刷新数据库、备份迁移后保留草稿、状态与笔记题目关联', async () => {
    const name = crypto.randomUUID()
    const first = newStore(name)
    const { id, kind, updatedAt: _, ...fields } = planRecord()
    await first.updatePlan(id, kind, fields)
    await first.close()
    const reopened = newStore(name)
    const saved = await reopened.allPlan()
    expect(saved[0]).toMatchObject(fields)
    const restored = newStore()
    await restored.import(await reopened.export())
    expect(await restored.allPlan()).toEqual(saved)
  })
  it('连续更新不同字段时不会丢失草稿、状态或关联', async () => {
    const store = newStore()
    await Promise.all([
      store.updatePlan('unity-week-01', 'task', { notes: '关键证据' }),
      store.updatePlan('unity-week-01', 'task', { status: 'completed' }),
      store.updatePlan('unity-week-01', 'task', { articleIds: ['csharp-memory-basics'] }),
    ])
    expect((await store.allPlan())[0]).toMatchObject({
      notes: '关键证据',
      status: 'completed',
      articleIds: ['csharp-memory-basics'],
    })
  })
  it('按时间合并计划记录，保留暂未识别的内容关联', async () => {
    const store = newStore()
    await store.import(backup([{ ...planRecord(), articleIds: ['future-note'] }]))
    await store.import(backup([{ ...planRecord('2026-10-24T01:00:00.000Z'), notes: '旧草稿' }]))
    expect((await store.allPlan())[0]).toMatchObject({
      notes: planRecord().notes,
      articleIds: ['future-note'],
    })
  })
  it('导入第一版或第二版备份不清除当前计划和案例', async () => {
    const store = newStore()
    await store.import(backup([planRecord()]))
    for (const schemaVersion of [1, 2]) {
      const parsed = parseBackup(
        JSON.stringify({
          app: 'BetterSelf',
          schemaVersion,
          exportedAt: '2026-10-25T01:00:00.000Z',
          records: [],
        }),
      )
      expect(parsed.schemaVersion).toBe(3)
      expect(parsed.planRecords).toEqual([])
      await store.import(parsed)
    }
    expect(await store.allPlan()).toEqual([planRecord()])
  })
  it('第二版备份保留显式移出复习的状态，不重新按自评推导', () => {
    const result = parseBackup(
      JSON.stringify({
        app: 'BetterSelf',
        schemaVersion: 2,
        exportedAt: '2026-10-25T01:00:00.000Z',
        records: [
          {
            id: 'q-old',
            kind: 'question',
            mastery: 'uncertain',
            favorite: true,
            progress: 0,
            lastViewedAt: null,
            reviewState: 'none',
            updatedAt: '2026-10-25T01:00:00.000Z',
          },
        ],
      }),
    )
    expect(result.records[0]).toMatchObject({
      mastery: 'uncertain',
      reviewState: 'none',
      favorite: true,
    })
    expect(result.planRecords).toEqual([])
  })
  it('计划中包含无效记录时，在写入任何学习或计划记录前拒绝整份导入', async () => {
    const store = newStore()
    await store.import(backup([planRecord()]))
    const malformed = backup([{ ...planRecord(), status: 'unexpected' } as unknown as PlanRecord])
    malformed.records.push({
      id: 'new-note',
      kind: 'article',
      mastery: null,
      favorite: false,
      progress: 0,
      lastViewedAt: null,
      reviewState: 'none',
      updatedAt: '2026-10-25T01:00:00.000Z',
    })
    await expect(store.import(malformed)).rejects.toThrow('无效')
    expect(await store.all()).toEqual([])
    expect(await store.allPlan()).toEqual([planRecord()])
  })
  it('拒绝缺失计划字段、重复 ID、无效关联和超长草稿', () => {
    const item = planRecord()
    expect(() => parseBackup(JSON.stringify({ ...backup([]), planRecords: undefined }))).toThrow(
      '缺少',
    )
    expect(() => parseBackup(JSON.stringify(backup([item, item])))).toThrow('重复')
    for (const patch of [
      { notes: 'a'.repeat(20_001) },
      { articleIds: ['x', 'x'] },
      { questionIds: ['<script>'] },
      { kind: 'article' },
    ]) {
      expect(() =>
        parseBackup(JSON.stringify(backup([{ ...item, ...patch } as PlanRecord]))),
      ).toThrow('无效')
    }
  })
  it('路线推荐的笔记与练习都存在于当前内容库', () => {
    for (const task of planTasks) {
      for (const id of task.articleIds || [])
        expect(articles.some((item) => item.id === id)).toBe(true)
      for (const id of task.questionIds || [])
        expect(questions.some((item) => item.id === id)).toBe(true)
    }
    for (const item of planCases) {
      for (const id of item.articleIds || [])
        expect(articles.some((article) => article.id === id)).toBe(true)
      if (item.projectId)
        expect(projects.some((project) => project.id === item.projectId)).toBe(true)
    }
  })
})
