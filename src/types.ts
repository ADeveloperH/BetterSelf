export type Mastery = 'unknown' | 'uncertain' | 'mastered'
export type ContentKind = 'article' | 'question'
export interface LearningRecord {
  id: string
  kind: ContentKind
  mastery: Mastery | null
  favorite: boolean
  progress: number
  lastViewedAt: string | null
  updatedAt: string
}
export interface Backup {
  app: 'BetterSelf'
  schemaVersion: 1
  exportedAt: string
  records: LearningRecord[]
}
export interface Source {
  title: string
  url: string
}
export interface Article {
  id: string
  title: string
  summary: string
  topic: string
  tags: string[]
  html: string
  toc: { id: string; title: string }[]
  minutes: number
  sample: boolean
  updatedAt: string
  verifiedAt: string
  applicability: string
  sources: Source[]
  searchText: string
}
export interface Question {
  id: string
  title: string
  topic: string
  tags: string[]
  level: string
  shortAnswer: string
  shortAnswerHtml: string
  explanationHtml: string
  pitfalls: string[]
  followUps: string[]
  articleIds: string[]
  sample: boolean
  updatedAt: string
  verifiedAt: string
  applicability: string
  sources: Source[]
  searchText: string
}
