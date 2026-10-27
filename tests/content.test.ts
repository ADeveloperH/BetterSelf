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
    expect(collection.articles).toHaveLength(21)
    expect(collection.questions).toHaveLength(5)
    expect(collection.projects).toHaveLength(1)
    expect(collection.articles.every((article) => article.toc.length > 0)).toBe(true)
    expect(
      (await compileContent(fileURLToPath(new URL('../content/', import.meta.url)))).contentVersion,
    ).toBe(collection.contentVersion)
  })
  it('十六篇迁移稿保留公开原文对照，并标明实际采集方式', () => {
    const withOriginal = collection.articles.filter((article) => article.original)
    expect(withOriginal).toHaveLength(16)
    expect(csharpArticle.original).toBeNull()
    expect(
      collection.articles.find((article) => article.id === 'unity-jenkins-macos-build')?.original,
    ).toBeNull()
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
    expect(
      withOriginal.find((article) => article.id === 'unity-android-proguard-dictionary')?.original
        ?.html,
    ).toContain('已隐去本机用户名、项目名和绝对路径')
    expect(
      withOriginal.find((article) => article.id === 'unity-external-dependency-manager')?.original
        ?.html,
    ).toContain('内部仓库、项目与插件配置')
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
  it('原追问知识并入完整案例答案，搜索能够命中处理与验证细节', () => {
    for (const question of collection.questions) {
      expect(question.explanationHtml).toContain('案例')
      expect(question.explanationHtml).toMatch(/验证|测试/)
      expect(question).not.toHaveProperty('followUps')
      expect(question).not.toHaveProperty('parentId')
      expect(question.sample).toBe(true)
      expect(question.verifiedAt).toBeNull()
    }
    expect(
      collection.questions.find((item) => item.id === 'q-value-reference')?.explanationHtml,
    ).toContain('Replace')
    expect(
      collection.questions.find((item) => item.id === 'q-string-builder')?.searchText,
    ).toContain('语言切换')
    expect(collection.questions.find((item) => item.id === 'q-gc-alloc')?.searchText).toContain(
      '迟到回调',
    )
    expect(collection.questions.find((item) => item.id === 'q-coroutines')?.searchText).toContain(
      'nativecontainer',
    )
  })
  it('项目实践只聚合存在且同主题的公开文章', () => {
    const { articles, questions } = fixture()
    const projects = structuredClone(collection.projects)
    expect(() => validateContent(articles, questions, collection.domains, projects)).not.toThrow()
    projects[0].articleIds = ['missing-article']
    expect(() => validateContent(articles, questions, collection.domains, projects)).toThrow(
      '不存在',
    )
    projects[0].articleIds = ['csharp-memory-basics']
    expect(() => validateContent(articles, questions, collection.domains, projects)).toThrow(
      '主题不一致',
    )
  })
  it('来源链接只接受 HTTPS，日期必须真实有效', () => {
    const invalidSource = fixture()
    invalidSource.questions[0].sources[0].url = 'javascript:alert(1)'
    expect(() => validateContent(invalidSource.articles, invalidSource.questions)).toThrow('HTTPS')
    const invalidDate = fixture()
    invalidDate.questions[0].updatedAt = '2026-02-30'
    expect(() => validateContent(invalidDate.articles, invalidDate.questions)).toThrow('日期无效')
  })
  it('Markdown 转义原始 HTML，并标记外链交给应用内参考资料弹窗处理', () => {
    const { html } = renderMarkdown(
      '<script>alert(1)</script>\n\n[官方文档](https://example.com)\n\n| A | B |\n| - | - |\n| 1 | 2 |',
    )
    expect(html).not.toContain('<script>')
    expect(html).toContain('rel="noreferrer"')
    expect(html).toContain('data-external-link=""')
    expect(html).not.toContain('target="_blank"')
    expect(html).toContain('class="table-scroll"')
    expect(html).toContain('aria-label="可左右滑动的表格"')
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
