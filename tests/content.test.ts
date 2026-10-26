import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { compileContent, renderMarkdown, validateContent } from '../scripts/content.mjs'
import { matchesSearch } from '../src/lib/content'
import { emptyNoteFilters, matchesNoteFilters, noteLocation } from '../src/lib/notes'
import type { Article } from '../src/types'

const collection = await compileContent(fileURLToPath(new URL('../content/', import.meta.url)))
const csharpArticle = collection.articles.find((article) => article.id === 'csharp-memory-basics')!
const fixture = () => ({
  articles: collection.articles.map((article) => ({ ...article, body: '正文' })),
  questions: structuredClone(collection.questions),
})

describe('内容进入网站前的校验', () => {
  it('实际示例可以构建，并保留稳定的内容指纹', async () => {
    expect(collection.articles).toHaveLength(13)
    expect(collection.questions).toHaveLength(5)
    expect(collection.articles.every((article) => article.toc.length > 0)).toBe(true)
    expect(
      (await compileContent(fileURLToPath(new URL('../content/', import.meta.url)))).contentVersion,
    ).toBe(collection.contentVersion)
  })
  it('十二篇迁移稿保留公开原文对照，并标明实际采集方式', () => {
    const withOriginal = collection.articles.filter((article) => article.original)
    expect(withOriginal).toHaveLength(12)
    expect(csharpArticle.original).toBeNull()
    expect(
      withOriginal.find((article) => article.id === 'vscode-emmet-html')?.original?.html,
    ).toContain('!+回车')
    const publishedOriginals = JSON.stringify(withOriginal.map((article) => article.original))
    expect(publishedOriginals).not.toMatch(/WEB[0-9a-f]{20,}/i)
    expect(publishedOriginals).not.toContain('/Users/')
    expect(
      withOriginal.find((article) => article.id === 'android-handler-message-loop')?.original
        ?.captureMethod,
    ).toBe('mcp-text')
    expect(
      withOriginal.find((article) => article.id === 'mmkv-storage-mechanics')?.original?.updatedAt,
    ).toBeNull()
    expect(
      withOriginal.find((article) => article.id === 'unity-addressables-remote-content')?.original
        ?.html,
    ).toContain('已隐去本机项目绝对路径')
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
  it('Markdown 转义原始 HTML，外部链接保留返回历史并隔离引用', () => {
    const { html } = renderMarkdown('<script>alert(1)</script>\n\n[官方文档](https://example.com)')
    expect(html).not.toContain('<script>')
    expect(html).toContain('rel="noreferrer"')
    expect(html).not.toContain('target="_blank"')
  })
  it('中文、C# 和全角输入能够检索，并支持多个关键字', () => {
    expect(matchesSearch(csharpArticle.searchText, '引用类型')).toBe(true)
    expect(matchesSearch(csharpArticle.searchText, 'Ｃ＃ Unity')).toBe(true)
    expect(collection.questions.some((question) => matchesSearch(question.searchText, 'GC'))).toBe(
      true,
    )
    expect(matchesSearch(csharpArticle.searchText, '不存在的关键词')).toBe(false)
  })
  it('个人笔记允许真实署名和未核验状态，仍拒绝不安全外链和不存在的分类', () => {
    const { articles, questions } = fixture()
    articles[0].verifiedAt = null
    articles[0].sources = [{ kind: 'personal', title: '个人实践记录' }]
    expect(() => validateContent(articles, questions, collection.domains)).not.toThrow()
    articles[0].categoryId = 'missing'
    expect(() => validateContent(articles, questions, collection.domains)).toThrow('分类不存在')
  })
  it('主题、子分类、类型与标签组合筛选，分类展示与搜索一致', () => {
    const article = csharpArticle as Article
    const filters = {
      ...emptyNoteFilters(),
      domain: 'programming',
      category: 'csharp',
      type: 'concept',
      tag: 'Unity',
    }
    expect(matchesNoteFilters(article, filters)).toBe(true)
    expect(matchesNoteFilters(article, { ...filters, category: 'java' })).toBe(false)
    expect(matchesNoteFilters(article, { ...filters, tag: 'Android' })).toBe(false)
    expect(noteLocation(article, collection.domains)).toBe('编程语言与基础 / C#')
    expect(matchesSearch(article.searchText, '编程语言')).toBe(true)
  })
})
