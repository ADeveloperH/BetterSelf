import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { parse } from 'yaml'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js/lib/core'
import csharp from 'highlight.js/lib/languages/csharp'

hljs.registerLanguage('csharp', csharp)
const markdown = new MarkdownIt({
  html: false,
  highlight(code, language) {
    return language === 'csharp' ? hljs.highlight(code, { language }).value : ''
  },
})
const linkRenderer = markdown.renderer.rules.link_open
markdown.renderer.rules.link_open = (tokens, index, options, env, self) => {
  if (/^https?:/.test(tokens[index].attrGet('href') || '')) {
    tokens[index].attrSet('target', '_blank')
    tokens[index].attrSet('rel', 'noopener noreferrer')
  }
  return linkRenderer
    ? linkRenderer(tokens, index, options, env, self)
    : self.renderToken(tokens, index, options)
}
markdown.renderer.rules.heading_open = (tokens, index, options, env, self) => {
  if (tokens[index].tag === 'h2') {
    const id = `section-${env.toc.length + 1}`
    tokens[index].attrSet('id', id)
    env.toc.push({ id, title: tokens[index + 1].content })
  }
  return self.renderToken(tokens, index, options)
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function string(value) {
  return typeof value === 'string' && value.trim().length > 0
}

export function validateContent(articles, questions, domains = []) {
  assert(Array.isArray(articles) && Array.isArray(questions), '内容必须为数组')
  const ids = new Set()
  for (const [kind, items] of [
    ['文章', articles],
    ['题目', questions],
  ]) {
    for (const item of items) {
      assert(item && typeof item === 'object', `${kind}内容无效`)
      const label = `${kind} ${item.id || '（缺少 ID）'}`
      for (const field of ['id', 'title', 'topic', 'applicability'])
        assert(string(item[field]), `${label} 缺少 ${field}`)
      assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id), `${label} ID 格式无效`)
      assert(!ids.has(item.id), `${label} ID 重复`)
      ids.add(item.id)
      assert(typeof item.sample === 'boolean', `${label} 缺少示例标识`)
      assert(
        Array.isArray(item.tags) && item.tags.length > 0 && item.tags.every(string),
        `${label} 标签无效`,
      )
      for (const field of ['updatedAt', 'verifiedAt']) {
        const date = item[field]
        if (field === 'verifiedAt' && (date === null || date === undefined)) continue
        assert(
          typeof date === 'string' &&
            /^\d{4}-\d{2}-\d{2}$/.test(date) &&
            Number.isFinite(Date.parse(date)) &&
            new Date(date).toISOString().slice(0, 10) === date,
          `${label} ${field} 日期无效`,
        )
      }
      assert(Array.isArray(item.sources) && item.sources.length > 0, `${label} 缺少来源`)
      for (const source of item.sources) {
        assert(string(source.title), `${label} 来源字段缺失`)
        assert([undefined, 'external', 'personal'].includes(source.kind), `${label} 来源类型无效`)
        if (source.kind === 'personal') {
          assert(source.url === undefined, `${label} 个人记录不应包含外部链接`)
          continue
        }
        assert(string(source.url), `${label} 来源字段缺失`)
        let url
        try {
          url = new URL(source.url)
        } catch {
          throw new Error(`${label} 来源链接无效`)
        }
        assert(url.protocol === 'https:', `${label} 来源必须使用 HTTPS`)
      }
      if (kind === '文章') {
        assert(string(item.summary) && string(item.body), `${label} 缺少摘要或正文`)
        for (const field of ['domainId', 'categoryId'])
          assert(
            string(item[field]) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item[field]),
            `${label} ${field} 无效`,
          )
        assert(
          ['concept', 'guide', 'troubleshooting', 'retrospective', 'resources'].includes(
            item.noteType,
          ),
          `${label} 笔记类型无效`,
        )
        if (domains.length) {
          const domain = domains.find((domain) => domain.id === item.domainId)
          assert(
            domain?.categories.some((category) => category.id === item.categoryId),
            `${label} 分类不存在`,
          )
        }
      } else {
        for (const field of ['shortAnswer', 'explanation'])
          assert(string(item[field]), `${label} 缺少 ${field}`)
        assert(['基础', '原理', '场景'].includes(item.level), `${label} 难度无效`)
        for (const field of ['pitfalls', 'followUps', 'articleIds']) {
          assert(
            Array.isArray(item[field]) && item[field].length > 0 && item[field].every(string),
            `${label} ${field} 无效`,
          )
        }
      }
    }
  }
  const articleIds = new Set(articles.map((article) => article.id))
  for (const question of questions) {
    for (const id of question.articleIds)
      assert(articleIds.has(id), `题目 ${question.id} 关联的文章 ${id} 不存在`)
  }
}

export function renderMarkdown(text) {
  const env = { toc: [] }
  return { html: markdown.render(text, env), toc: env.toc }
}

export async function compileContent(root) {
  const domains = parse(await readFile(path.join(root, 'taxonomy.yaml'), 'utf8'))
  assert(Array.isArray(domains) && domains.length > 0, '缺少主题分类')
  const domainIds = new Set()
  for (const domain of domains) {
    assert(
      string(domain.id) && string(domain.title) && !domainIds.has(domain.id),
      '主题分类无效或重复',
    )
    domainIds.add(domain.id)
    assert(Array.isArray(domain.categories) && domain.categories.length > 0, '缺少子分类')
    const categoryIds = new Set()
    for (const category of domain.categories) {
      assert(
        string(category.id) && string(category.title) && !categoryIds.has(category.id),
        '子分类无效或重复',
      )
      categoryIds.add(category.id)
    }
  }
  const articleDirectory = path.join(root, 'articles')
  const originalDirectory = path.join(root, 'originals')
  const questionDirectory = path.join(root, 'questions')
  const articles = []
  const originals = new Map()
  const questions = []
  for (const file of (await readdir(articleDirectory))
    .filter((name) => name.endsWith('.md'))
    .sort()) {
    const source = await readFile(path.join(articleDirectory, file), 'utf8')
    const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
    assert(match, `${file} 缺少 YAML 头部或正文`)
    articles.push({ ...parse(match[1]), body: match[2] })
  }
  for (const file of (await readdir(originalDirectory))
    .filter((name) => name.endsWith('.md'))
    .sort()) {
    const source = await readFile(path.join(originalDirectory, file), 'utf8')
    const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
    assert(match, `${file} 原文缺少 YAML 头部或正文`)
    const metadata = parse(match[1])
    assert(string(metadata.id) && string(metadata.title), `${file} 原文缺少 ID 或标题`)
    assert(!originals.has(metadata.id), `${file} 原文 ID 重复`)
    originals.set(metadata.id, {
      title: metadata.title,
      updatedAt: metadata.updatedAt,
      body: match[2],
    })
  }
  for (const id of originals.keys())
    assert(
      articles.some((article) => article.id === id),
      `原文 ${id} 没有对应的整理稿`,
    )
  for (const file of (await readdir(questionDirectory))
    .filter((name) => /\.ya?ml$/.test(name))
    .sort()) {
    const parsed = parse(await readFile(path.join(questionDirectory, file), 'utf8'))
    assert(Array.isArray(parsed), `${file} 必须包含题目数组`)
    questions.push(...parsed)
  }
  validateContent(articles, questions, domains)
  const searchable = (...values) => values.flat(Infinity).join(' ').normalize('NFKC').toLowerCase()
  const result = {
    domains,
    articles: articles.map(({ body, ...article }) => {
      const original = originals.get(article.id)
      return {
        ...article,
        verifiedAt: article.verifiedAt ?? null,
        ...renderMarkdown(body),
        minutes: Math.max(1, Math.ceil(body.length / 380)),
        original: original
          ? {
              title: original.title,
              updatedAt: original.updatedAt,
              ...renderMarkdown(original.body),
              minutes: Math.max(1, Math.ceil(original.body.length / 380)),
            }
          : null,
        searchText: searchable(
          article.title,
          article.summary,
          article.tags,
          article.topic,
          domains.find((domain) => domain.id === article.domainId)?.title,
          domains
            .find((domain) => domain.id === article.domainId)
            ?.categories.find((category) => category.id === article.categoryId)?.title,
          body,
          original?.body,
        ),
      }
    }),
    questions: questions.map((question) => ({
      ...question,
      verifiedAt: question.verifiedAt ?? null,
      shortAnswerHtml: renderMarkdown(question.shortAnswer).html,
      explanationHtml: renderMarkdown(question.explanation).html,
      searchText: searchable(
        question.title,
        question.tags,
        question.shortAnswer,
        question.explanation,
        question.pitfalls,
        question.followUps,
      ),
    })),
  }
  return {
    ...result,
    contentVersion: createHash('sha256').update(JSON.stringify(result)).digest('hex').slice(0, 10),
  }
}
