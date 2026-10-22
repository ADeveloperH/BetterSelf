import type { Article, Domain, NoteType } from '../types'

export const noteTypeLabels: Record<NoteType, string> = {
  concept: '原理概念',
  guide: '操作指南',
  troubleshooting: '问题排查',
  retrospective: '项目复盘',
  resources: '资料索引',
}
export interface NoteFilters {
  domain: string
  category: string
  type: string
  tag: string
}
export const emptyNoteFilters = (): NoteFilters => ({ domain: '', category: '', type: '', tag: '' })
export function matchesNoteFilters(article: Article, filters: NoteFilters) {
  return (
    (!filters.domain || article.domainId === filters.domain) &&
    (!filters.category || article.categoryId === filters.category) &&
    (!filters.type || article.noteType === filters.type) &&
    (!filters.tag || article.tags.includes(filters.tag))
  )
}
export function noteLocation(article: Article, domains: Domain[]) {
  const domain = domains.find((item) => item.id === article.domainId)
  return [domain?.title, domain?.categories.find((item) => item.id === article.categoryId)?.title]
    .filter(Boolean)
    .join(' / ')
}
