export type Mastery = 'unknown' | 'uncertain' | 'mastered'
export type ContentKind = 'article' | 'question'
export type ReviewState = 'none' | 'active' | 'completed'
export interface LearningRecord {
  id: string
  kind: ContentKind
  mastery: Mastery | null
  favorite: boolean
  progress: number
  lastViewedAt: string | null
  reviewState: ReviewState
  updatedAt: string
}
export interface Backup {
  app: 'BetterSelf'
  schemaVersion: 2
  exportedAt: string
  records: LearningRecord[]
}
export interface Source {
  title: string
  kind?: 'external' | 'personal'
  url?: string
}
export interface Domain {
  id: string
  title: string
  categories: { id: string; title: string }[]
}
export type NoteType = 'concept' | 'guide' | 'troubleshooting' | 'retrospective' | 'resources'
export interface Article {
  id: string
  title: string
  summary: string
  topic: string
  domainId: string
  categoryId: string
  noteType: NoteType
  tags: string[]
  html: string
  toc: { id: string; title: string }[]
  minutes: number
  sample: boolean
  updatedAt: string
  verifiedAt: string | null
  applicability: string
  sources: Source[]
  original: {
    title: string
    updatedAt: string
    html: string
    toc: { id: string; title: string }[]
    minutes: number
  } | null
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
  verifiedAt: string | null
  applicability: string
  sources: Source[]
  searchText: string
}
