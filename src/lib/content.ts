import content from '../generated/content.json'
import type { Article, Question } from '../types'

export const articles: Article[] = content.articles
export const questions: Question[] = content.questions
export const contentVersion = content.contentVersion
export function matchesSearch(searchText: string, query: string) {
  const words = query.normalize('NFKC').trim().toLowerCase().split(/\s+/).filter(Boolean)
  return words.every((word) => searchText.includes(word))
}
