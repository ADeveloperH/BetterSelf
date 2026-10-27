import questionRedirects from '../../content/question-redirects.json'
import type { LearningRecord, Question } from '../types'

export const mergedQuestionIds: Readonly<Record<string, string>> = questionRedirects
export const questionId = (id: string) =>
  Object.hasOwn(mergedQuestionIds, id) ? mergedQuestionIds[id] : id

/** Old question links continue to open the complete answer. */
export function resolveQuestionRoute(route: string) {
  const match = route.match(/^\/practice\/([^/]+)$/)
  return match ? `/practice/${questionId(match[1])}` : route
}

export const questionLinks = (ids: string[]) => [...new Set(ids.map(questionId))]

/** Consolidate ratings conservatively; mastering one section does not master the whole answer. */
export function mergeQuestionRecords(records: LearningRecord[]) {
  const grouped = new Map<string, LearningRecord[]>()
  for (const record of records) {
    const id = record.kind === 'question' ? questionId(record.id) : record.id
    grouped.set(id, [...(grouped.get(id) || []), record])
  }
  return [...grouped].map(([id, group]) => {
    if (group.length === 1 && group[0].id === id) return group[0]
    const parent = group.find((record) => record.id === id)
    const latest = group.reduce((a, b) => (a.updatedAt > b.updatedAt ? a : b))
    const mastery = group.some((record) => record.mastery === 'unknown')
      ? 'unknown'
      : group.some((record) => record.mastery === 'uncertain')
        ? 'uncertain'
        : parent?.mastery || null
    return {
      ...latest,
      id,
      mastery,
      favorite: group.some((record) => record.favorite),
      progress: parent?.progress || 0,
      lastViewedAt:
        group
          .map((record) => record.lastViewedAt)
          .filter((date): date is string => !!date)
          .sort()
          .at(-1) || null,
      reviewState: group.some((record) => record.reviewState === 'active')
        ? 'active'
        : parent?.reviewState || 'none',
    } as LearningRecord
  })
}

export function selectQuestions(
  questions: Question[],
  records: Record<string, LearningRecord>,
  topic: string,
  filter: string,
) {
  return questions.filter((question) => {
    if (topic !== 'all' && question.topic !== topic) return false
    if (filter === 'all') return true
    const record = records[question.id]
    if (filter === 'favorites') return !!record?.favorite
    if (filter === 'unrated') return !record?.mastery
    return record?.mastery === filter
  })
}
