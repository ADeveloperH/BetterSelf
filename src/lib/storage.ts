import { openDB, type DBSchema } from 'idb'
import type { Backup, ContentKind, LearningRecord } from '../types'

interface LearningDatabase extends DBSchema {
  records: { key: string; value: LearningRecord }
}

const isoDate = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value

export function parseBackup(text: string): Backup {
  if (text.length > 5_000_000) throw new Error('备份文件过大，请选择 5 MB 以内的文件。')
  let input: unknown
  try {
    input = JSON.parse(text)
  } catch {
    throw new Error('这不是有效的 JSON 备份文件。')
  }
  if (!input || typeof input !== 'object') throw new Error('备份文件格式不正确。')
  const data = input as Partial<Backup>
  if (
    data.app !== 'BetterSelf' ||
    data.schemaVersion !== 1 ||
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
      (record.lastViewedAt !== null && !isoDate(record.lastViewedAt))
    ) {
      throw new Error('备份中有无效或重复的学习记录，原有数据保持不变。')
    }
    seen.add(record.id)
    records.push({
      id: record.id,
      kind: record.kind,
      mastery: record.mastery,
      favorite: record.favorite,
      progress: record.progress,
      lastViewedAt: record.lastViewedAt,
      updatedAt: record.updatedAt,
    })
  }
  return { app: 'BetterSelf', schemaVersion: 1, exportedAt: data.exportedAt, records }
}

export function createLearningStore(name = 'betterself-learning') {
  const database = openDB<LearningDatabase>(name, 1, {
    upgrade(db) {
      db.createObjectStore('records', { keyPath: 'id' })
    },
  })
  return {
    async all() {
      return (await database).getAll('records')
    },
    async update(
      id: string,
      kind: ContentKind,
      patch: Partial<Pick<LearningRecord, 'mastery' | 'favorite' | 'progress' | 'lastViewedAt'>>,
    ) {
      const db = await database
      const tx = db.transaction('records', 'readwrite')
      const current = await tx.store.get(id)
      const next: LearningRecord = {
        id,
        kind,
        mastery: null,
        favorite: false,
        progress: 0,
        lastViewedAt: null,
        ...current,
        ...patch,
        updatedAt: new Date().toISOString(),
      }
      await tx.store.put(next)
      await tx.done
      return next
    },
    async export(): Promise<Backup> {
      return {
        app: 'BetterSelf',
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        records: await this.all(),
      }
    },
    async import(input: Backup) {
      const backup = parseBackup(JSON.stringify(input))
      const db = await database
      const tx = db.transaction('records', 'readwrite')
      let imported = 0
      for (const record of backup.records) {
        const current = await tx.store.get(record.id)
        if (!current || record.updatedAt > current.updatedAt) {
          await tx.store.put(record)
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
