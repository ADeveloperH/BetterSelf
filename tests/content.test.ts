import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { compileContent, renderMarkdown, validateContent } from '../scripts/content.mjs'
import { matchesSearch } from '../src/lib/content'

const collection = await compileContent(fileURLToPath(new URL('../content/', import.meta.url)))
const fixture = () => ({
  articles: collection.articles.map((article) => ({ ...article, body: '正文' })),
  questions: structuredClone(collection.questions),
})

describe('内容进入网站前的校验', () => {
  it('实际示例可以构建，并保留稳定的内容指纹', async () => {
    expect(collection.articles).toHaveLength(1)
    expect(collection.questions).toHaveLength(5)
    expect(collection.articles[0].toc.length).toBeGreaterThan(0)
    expect(
      (await compileContent(fileURLToPath(new URL('../content/', import.meta.url)))).contentVersion,
    ).toBe(collection.contentVersion)
  })
  it('阻止重复 ID 造成学习记录错配', () => {
    const { articles, questions } = fixture()
    questions[1].id = questions[0].id
    expect(() => validateContent(articles, questions)).toThrow('ID 重复')
  })
  it('阻止不存在的文章关联进入发布内容', () => {
    const { articles, questions } = fixture()
    questions[0].articleIds = ['missing-article']
    expect(() => validateContent(articles, questions)).toThrow('不存在')
  })
  it('来源链接只接受 HTTPS，日期必须真实有效', () => {
    const invalidSource = fixture()
    invalidSource.questions[0].sources[0].url = 'javascript:alert(1)'
    expect(() => validateContent(invalidSource.articles, invalidSource.questions)).toThrow('HTTPS')
    const invalidDate = fixture()
    invalidDate.questions[0].updatedAt = '2026-02-30'
    expect(() => validateContent(invalidDate.articles, invalidDate.questions)).toThrow('日期无效')
  })
  it('Markdown 转义原始 HTML，外部链接隔离窗口引用', () => {
    const { html } = renderMarkdown('<script>alert(1)</script>\n\n[官方文档](https://example.com)')
    expect(html).not.toContain('<script>')
    expect(html).toContain('rel="noopener noreferrer"')
  })
  it('中文、C# 和全角输入能够检索，并支持多个关键字', () => {
    expect(matchesSearch(collection.articles[0].searchText, '引用类型')).toBe(true)
    expect(matchesSearch(collection.articles[0].searchText, 'Ｃ＃ Unity')).toBe(true)
    expect(collection.questions.some((question) => matchesSearch(question.searchText, 'GC'))).toBe(
      true,
    )
    expect(matchesSearch(collection.articles[0].searchText, '不存在的关键词')).toBe(false)
  })
})
