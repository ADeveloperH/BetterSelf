import { openDB, type DBSchema } from 'idb'
import type {
  Backup,
  ContentKind,
  LearningRecord,
  PlanKind,
  PlanRecord,
  ReviewState,
} from '../types'

interface LearningDatabase extends DBSchema {
  records: { key: string; value: LearningRecord }
  planRecords: { key: string; value: PlanRecord }
}

const isoDate = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value

function validPlanRecord(value: unknown): value is PlanRecord {
  if (!value || typeof value !== 'object') return false
  const item = value as PlanRecord
  return (
    typeof item.id === 'string' &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id) &&
    ['task', 'case'].includes(item.kind) &&
    ['todo', 'active', 'completed'].includes(item.status) &&
    typeof item.notes === 'string' &&
    item.notes.length <= 20_000 &&
    validLinks(item.articleIds) &&
    validLinks(item.questionIds) &&
    isoDate(item.updatedAt)
  )
}

function validLinks(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= 100 &&
    new Set(value).size === value.length &&
    value.every((id) => typeof id === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))
  )
}

// Old question self-ratings remain deliberate review choices; reading and bookmarks do not.
function withReviewState(
  record: Omit<LearningRecord, 'reviewState'> & { reviewState?: ReviewState },
): LearningRecord {
  return {
    ...record,
    reviewState:
      record.reviewState ??
      (record.kind === 'question' && ['unknown', 'uncertain'].includes(record.mastery || '')
        ? 'active'
        : 'none'),
  }
}

export function parseBackup(text: string): Backup {
  if (text.length > 5_000_000) throw new Error('备份文件过大，请选择 5 MB 以内的文件。')
  let input: unknown
  try {
    input = JSON.parse(text)
  } catch {
    throw new Error('这不是有效的 JSON 备份文件。')
  }
  if (!input || typeof input !== 'object') throw new Error('备份文件格式不正确。')
  const data = input as Partial<Omit<Backup, 'schemaVersion'>> & { schemaVersion?: number }
  if (
    data.app !== 'BetterSelf' ||
    ![1, 2, 3].includes(data.schemaVersion as number) ||
    !isoDate(data.exportedAt) ||
    !Array.isArray(data.records)
  ) {
    throw new Error('无法识别这份备份，或其格式版本暂不受支持。')
  }
  const seen = new Set()
  const records: LearningRecord[] = []
  for (const record of data.records) {
    if (
      !record ||
      typeof record !== 'object' ||
      typeof record.id !== 'string' ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(record.id) ||
      seen.has(record.id) ||
      !['article', 'question'].includes(record.kind) ||
      typeof record.favorite !== 'boolean' ||
      ![null, 'unknown', 'uncertain', 'mastered'].includes(record.mastery) ||
      (record.kind === 'article' && record.mastery !== null) ||
      typeof record.progress !== 'number' ||
      !Number.isFinite(record.progress) ||
      record.progress < 0 ||
      record.progress > 1 ||
      !isoDate(record.updatedAt) ||
      (record.lastViewedAt !== null && !isoDate(record.lastViewedAt)) ||
      (data.schemaVersion !== 1 && !['none', 'active', 'completed'].includes(record.reviewState))
    ) {
      throw new Error('备份中有无效或重复的学习记录，原有数据保持不变。')
    }
    seen.add(record.id)
    records.push(
      withReviewState({
        id: record.id,
        kind: record.kind,
        mastery: record.mastery,
        favorite: record.favorite,
        progress: record.progress,
        lastViewedAt: record.lastViewedAt,
        updatedAt: record.updatedAt,
        reviewState: data.schemaVersion !== 1 ? record.reviewState : undefined,
      }),
    )
  }
  const planRecords: PlanRecord[] = []
  if (data.schemaVersion === 3) {
    if (!Array.isArray(data.planRecords))
      throw new Error('备份缺少成长计划记录，原有数据保持不变。')
    const planIds = new Set<string>()
    for (const item of data.planRecords) {
      if (!validPlanRecord(item) || planIds.has(item.id)) {
        throw new Error('备份中有无效或重复的成长计划记录，原有数据保持不变。')
      }
      planIds.add(item.id)
      planRecords.push({
        id: item.id,
        kind: item.kind,
        status: item.status,
        notes: item.notes,
        articleIds: [...item.articleIds],
        questionIds: [...item.questionIds],
        updatedAt: item.updatedAt,
      })
    }
  }
  return { app: 'BetterSelf', schemaVersion: 3, exportedAt: data.exportedAt, records, planRecords }
}

export function createLearningStore(name = 'betterself-learning') {
  const database = openDB<LearningDatabase>(name, 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) db.createObjectStore('records', { keyPath: 'id' })
      if (oldVersion < 2) db.createObjectStore('planRecords', { keyPath: 'id' })
    },
    blocking() {
      void database.then((db) => db.close())
    },
  })
  return {
    async all() {
      return (await (await database).getAll('records')).map(withReviewState)
    },
    async allPlan() {
      return (await database).getAll('planRecords')
    },
    async updatePlan(
      id: string,
      kind: PlanKind,
      patch: Partial<Pick<PlanRecord, 'status' | 'notes' | 'articleIds' | 'questionIds'>>,
    ) {
      const db = await database
      const tx = db.transaction('planRecords', 'readwrite')
      const current = await tx.store.get(id)
      const next: PlanRecord = {
        id,
        kind,
        status: 'todo',
        notes: '',
        articleIds: [],
        questionIds: [],
        ...current,
        ...patch,
        updatedAt: new Date().toISOString(),
      }
      if (!validPlanRecord(next) || next.kind !== kind) {
        throw new Error('成长计划记录格式不正确。')
      }
      // Vue exposes selected links as reactive arrays; IndexedDB only accepts plain data.
      next.articleIds = [...next.articleIds]
      next.questionIds = [...next.questionIds]
      await tx.store.put(next)
      await tx.done
      return next
    },
    async update(
      id: string,
      kind: ContentKind,
      patch: Partial<
        Pick<LearningRecord, 'mastery' | 'favorite' | 'progress' | 'lastViewedAt' | 'reviewState'>
      >,
    ) {
      const db = await database
      const tx = db.transaction('records', 'readwrite')
      const stored = await tx.store.get(id)
      const current = stored ? withReviewState(stored) : undefined
      const next: LearningRecord = {
        id,
        kind,
        mastery: null,
        favorite: false,
        progress: 0,
        lastViewedAt: null,
        reviewState: 'none',
        ...current,
        ...patch,
        updatedAt: new Date().toISOString(),
      }
      if (kind === 'question' && patch.mastery && patch.reviewState === undefined) {
        next.reviewState =
          patch.mastery === 'mastered'
            ? current?.reviewState === 'active'
              ? 'completed'
              : current?.reviewState || 'none'
            : 'active'
      }
      await tx.store.put(next)
      await tx.done
      return next
    },
    async export(): Promise<Backup> {
      return {
        app: 'BetterSelf',
        schemaVersion: 3,
        exportedAt: new Date().toISOString(),
        records: await this.all(),
        planRecords: await this.allPlan(),
      }
    },
    async import(input: Backup) {
      const backup = parseBackup(JSON.stringify(input))
      const db = await database
      const tx = db.transaction(['records', 'planRecords'], 'readwrite')
      let imported = 0
      for (const record of backup.records) {
        const current = await tx.objectStore('records').get(record.id)
        if (!current || record.updatedAt > current.updatedAt) {
          await tx.objectStore('records').put(record)
          imported++
        }
      }
      for (const record of backup.planRecords) {
        const current = await tx.objectStore('planRecords').get(record.id)
        if (!current || record.updatedAt > current.updatedAt) {
          await tx.objectStore('planRecords').put(record)
          imported++
        }
      }
      await tx.done
      return imported
    },
    async close() {
      ;(await database).close()
    },
  }
}
