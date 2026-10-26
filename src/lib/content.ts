import content from '../generated/content.json'
import type { Article, Domain, ProjectCollection, Question } from '../types'

// These shapes are validated by the content compiler before generation.
export const articles = content.articles as Article[]
export const questions = content.questions as Question[]
export const contentVersion = content.contentVersion
export const domains: Domain[] = content.domains
export const projects = content.projects as ProjectCollection[]
export function matchesSearch(searchText: string, query: string) {
  const words = query.normalize('NFKC').trim().toLowerCase().split(/\s+/).filter(Boolean)
  return words.every((word) => searchText.includes(word))
}
