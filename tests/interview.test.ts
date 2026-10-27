import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { compileContent, validateQuestionRedirects } from '../scripts/content.mjs'
import { mergedQuestionIds, resolveQuestionRoute, selectQuestions } from '../src/lib/interview'
import { Navigation } from '../src/lib/navigation'
import type { LearningRecord, Question } from '../src/types'

const { questions } = (await compileContent(
  fileURLToPath(new URL('../content/', import.meta.url)),
)) as { questions: Question[] }
const id = 'q-value-reference'
const record: LearningRecord = {
  id,
  kind: 'question',
  favorite: true,
  mastery: 'uncertain',
  reviewState: 'active',
  progress: 0,
  lastViewedAt: null,
  updatedAt: '2026-10-27T00:00:00.000Z',
}

describe('完整案例答案与旧链接兼容', () => {
  it('所有专题只列完整问题，专题和个人筛选可以组合', () => {
    expect(selectQuestions(questions, {}, 'all', 'all')).toHaveLength(5)
    expect(selectQuestions(questions, {}, 'C# 与内存', 'all')).toHaveLength(3)
    for (const filter of ['favorites', 'uncertain'])
      expect(
        selectQuestions(questions, { [id]: record }, 'all', filter).map((item) => item.id),
      ).toEqual([id])
    expect(
      selectQuestions(questions, { [id]: record }, 'all', 'unrated').some((item) => item.id === id),
    ).toBe(false)
    expect(
      selectQuestions(questions, { [id]: record }, '移动端性能诊断', 'favorites'),
    ).toHaveLength(0)
  })
  it('全部旧追问链接打开有效完整题目，不形成新的父子层级', () => {
    expect(Object.keys(mergedQuestionIds)).toHaveLength(10)
    for (const [alias, target] of Object.entries(mergedQuestionIds)) {
      const route = resolveQuestionRoute(`/practice/${alias}`)
      expect(route).toBe(`/practice/${target}`)
      expect(questions.some((item) => item.id === target)).toBe(true)
      const nav = new Navigation(route)
      expect(nav.parent?.route).toBe('/practice')
      nav.back()
      expect(nav.current.route).toBe('/practice')
    }
    expect(resolveQuestionRoute('/article/csharp-memory-basics')).toBe(
      '/article/csharp-memory-basics',
    )
    expect(resolveQuestionRoute('/practice/unknown')).toBe('/practice/unknown')
  })
  it('合并别名不能占用现有题目或指向丢失目标', () => {
    expect(() => validateQuestionRedirects(questions, { 'old-id': 'missing' })).toThrow(
      '合并目标不存在',
    )
    expect(() => validateQuestionRedirects(questions, { [id]: 'q-boxing' })).toThrow('冲突')
  })
})
