import { describe, expect, it } from 'vitest'
import { Navigation } from '../src/lib/navigation'

describe('独立 Tab 与多级详情导航', () => {
  it('切换 Tab 后恢复笔记详情、阅读位置和列表位置', () => {
    const nav = new Navigation('/')
    const list = nav.current
    list.scroll = 720
    nav.open('/article/handler')
    const detail = nav.current
    detail.scroll = 1280
    nav.selectTab('/practice')
    nav.open('/practice/question')
    nav.current.revealed = true
    nav.selectTab('/')
    expect(nav.current).toBe(detail)
    expect(nav.current.scroll).toBe(1280)
    expect(nav.parent).toBe(list)
    expect(nav.parent?.scroll).toBe(720)
    nav.selectTab('/practice')
    expect(nav.current.route).toBe('/practice/question')
    expect(nav.current.revealed).toBe(true)
  })

  it('搜索和复习打开的详情留在来源 Tab，并逐层返回', () => {
    const nav = new Navigation('/search')
    const search = nav.current
    search.view = { query: 'Handler', scope: 'article' }
    nav.open('/article/handler')
    const article = nav.current
    nav.open('/practice/question')
    expect(nav.current.tab).toBe('/search')
    expect(nav.parent).toBe(article)
    nav.back()
    expect(nav.parent).toBe(search)
    nav.back()
    expect(nav.current.view?.query).toBe('Handler')
    nav.open('/article/another')
    nav.openRoot('/search')
    expect(nav.current).toBe(search)
    nav.selectTab('/review')
    nav.open('/article/handler')
    expect(nav.current.tab).toBe('/review')
    expect(nav.parent?.route).toBe('/review')
  })

  it('切换 Tab 后使用真实历史回到父页，支持浏览器前进与返回', () => {
    const nav = new Navigation('/')
    const root = nav.current
    nav.open('/article/handler')
    const detail = nav.current
    nav.selectTab('/search')
    nav.selectTab('/')
    expect(nav.backDistance()).toBe(-3)
    expect(nav.restore(0, root.id)).toBe(true)
    expect(nav.current.route).toBe('/')
    expect(nav.restore(1, detail.id)).toBe(true)
    expect(nav.current).toBe(detail)
    expect(nav.restore(2, root.id)).toBe(false)
  })

  it('历史分支被截断后父页仍可返回，且不会跳到同位置的新历史', () => {
    const nav = new Navigation('/')
    nav.selectTab('/search')
    nav.open('/article/a')
    const parent = nav.current
    nav.open('/article/b')
    nav.restore(0, 0)
    nav.open('/article/c')
    nav.selectTab('/search')
    expect(nav.current.route).toBe('/article/b')
    expect(nav.backDistance()).toBe(0)
    nav.back()
    expect(nav.current).toBe(parent)
  })

  it('直达详情和刷新均有可返回的列表，并保留来源上下文', () => {
    const nav = new Navigation('/practice/question')
    expect(nav.parent?.route).toBe('/practice')
    nav.back()
    expect(nav.current.route).toBe('/practice')
    nav.selectTab('/review')
    nav.open('/article/a')
    nav.current.scroll = 900
    const restored = Object.assign(new Navigation('/'), JSON.parse(JSON.stringify(nav)))
    expect(restored.restore(nav.cursor, nav.current.id)).toBe(true)
    expect(restored.current.tab).toBe('/review')
    expect(restored.current.scroll).toBe(900)
    expect(restored.parent?.route).toBe('/review')
  })

  it('原文是整理稿的下一层，切换 Tab 后仍恢复原文页', () => {
    const nav = new Navigation('/')
    nav.open('/article/handler')
    const article = nav.current
    nav.open('/article/handler/original')
    const original = nav.current
    expect(nav.parent).toBe(article)
    nav.selectTab('/search')
    nav.selectTab('/')
    expect(nav.current).toBe(original)
    nav.back()
    expect(nav.current).toBe(article)
  })

  it('直达原文时自动补齐笔记库、整理稿和原文三级路径', () => {
    const nav = new Navigation('/article/handler/original')
    expect(nav.current.route).toBe('/article/handler/original')
    expect(nav.parent?.route).toBe('/article/handler')
    nav.back()
    expect(nav.current.route).toBe('/article/handler')
    nav.back()
    expect(nav.current.route).toBe('/')
  })
})
