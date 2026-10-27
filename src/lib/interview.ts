import type { LearningRecord, Question } from '../types'

export function questionAncestors(route: string, questions: Question[]) {
  const id = route.match(/^\/practice\/([^/]+)$/)?.[1]
  let question = questions.find((item) => item.id === id)
  const ancestors: string[] = []
  const seen = new Set<string>()
  while (question?.parentId && !seen.has(question.parentId)) {
    seen.add(question.parentId)
    const parent = questions.find((item) => item.id === question!.parentId)
    if (!parent) break
    ancestors.unshift(`/practice/${parent.id}`)
    question = parent
  }
  return ancestors
}

export function selectQuestions(
  questions: Question[],
  records: Record<string, LearningRecord>,
  topic: string,
  scope: string,
  filter: string,
) {
  return questions.filter((question) => {
    if (topic !== 'all' && question.topic !== topic) return false
    // Personal filters include child questions so their records never become hidden.
    if (filter === 'all') return scope === 'all' || !question.parentId
    const record = records[question.id]
    if (filter === 'favorites') return !!record?.favorite
    if (filter === 'unrated') return !record?.mastery
    return record?.mastery === filter
  })
}
