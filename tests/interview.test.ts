import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { compileContent } from '../scripts/content.mjs'
import { questionAncestors, selectQuestions } from '../src/lib/interview'
import { Navigation } from '../src/lib/navigation'
import type { LearningRecord, Question } from '../src/types'

const { questions } = (await compileContent(
  fileURLToPath(new URL('../content/', import.meta.url)),
)) as { questions: Question[] }
const id = 'q-struct-list-copy'
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

describe('面试主问题与追问', () => {
  it('默认只列主问题，可以按专题查看全部追问', () => {
    expect(selectQuestions(questions, {}, 'all', 'roots', 'all')).toHaveLength(5)
    const all = selectQuestions(questions, {}, 'C# 与内存', 'all', 'all')
    expect(all).toHaveLength(9)
    expect(all.some((question) => question.id === id)).toBe(true)
  })
  it('个人筛选不会因默认主问题范围隐藏追问记录', () => {
    for (const filter of ['favorites', 'uncertain'])
      expect(
        selectQuestions(questions, { [id]: record }, 'all', 'roots', filter).map((item) => item.id),
      ).toEqual([id])
    expect(
      selectQuestions(questions, { [id]: record }, 'all', 'all', 'unrated').some(
        (item) => item.id === id,
      ),
    ).toBe(false)
    expect(
      selectQuestions(questions, { [id]: record }, '移动端性能诊断', 'roots', 'favorites'),
    ).toHaveLength(0)
  })
  it('追问独立记录自评，不会改变主问题筛选状态', () => {
    const mastered = { ...record, mastery: 'mastered' as const, reviewState: 'completed' as const }
    const records = { [id]: mastered }
    expect(
      selectQuestions(questions, records, 'all', 'roots', 'unrated').some(
        (item) => item.id === 'q-value-reference',
      ),
    ).toBe(true)
    expect(
      selectQuestions(questions, records, 'all', 'roots', 'mastered').map((item) => item.id),
    ).toEqual([id])
  })
  it('直达追问补齐主问题层级，返回保留父页阅读与答案状态', () => {
    const route = `/practice/${id}`
    const nav = new Navigation(route, questionAncestors(route, questions))
    expect(nav.parent?.route).toBe('/practice/q-value-reference')
    nav.back()
    const parent = nav.current
    parent.revealed = true
    parent.scroll = 820
    nav.open(route)
    expect(nav.current.revealed).toBeUndefined()
    nav.back()
    expect(nav.current).toBe(parent)
    expect(nav.current.revealed).toBe(true)
    expect(nav.current.scroll).toBe(820)
    nav.back()
    expect(nav.current.route).toBe('/practice')
  })
})
