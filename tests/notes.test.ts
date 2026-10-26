import { describe, expect, it } from 'vitest'
import { articles } from '../src/lib/content'
import { noteDisplayTitle, noteStatus } from '../src/lib/notes'

const sample = articles.find((article) => article.sample)!
const historical = articles.find((article) => article.title.includes('（历史）'))!

describe('笔记展示状态', () => {
  it('示例内容优先显示示例状态', () => {
    expect(noteStatus(sample)).toEqual({ id: 'sample', label: '示例内容' })
  })

  it('历史笔记显示历史状态并移除标题标记', () => {
    expect(noteStatus(historical)).toEqual({ id: 'historical', label: '历史资料' })
    expect(noteDisplayTitle(historical)).not.toContain('（历史）')
  })

  it('区分已复核与待复核内容', () => {
    expect(
      noteStatus({
        ...sample,
        sample: false,
        title: '已复核笔记',
        applicability: '适用于当前版本',
      }),
    ).toEqual({ id: 'verified', label: '已复核' })
    expect(
      noteStatus({
        ...sample,
        sample: false,
        title: '待复核笔记',
        applicability: '尚未完成验证',
        verifiedAt: null,
      }),
    ).toEqual({ id: 'unverified', label: '待复核' })
  })
})
