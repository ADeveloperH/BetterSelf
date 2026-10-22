export const tabPaths = ['/', '/practice', '/review', '/search'] as const
export type TabPath = (typeof tabPaths)[number]
export type PageState = {
  id: number
  route: string
  tab: TabPath
  parent?: number
  scroll?: number
  revealed?: boolean
  view?: Record<string, unknown>
}

export function routeTab(route: string): TabPath {
  if (route.startsWith('/practice')) return '/practice'
  return tabPaths.includes(route as TabPath) ? (route as TabPath) : '/'
}

/** Page identity is independent of its URL: a note can be opened from any tab. */
export class Navigation {
  pages: PageState[] = []
  tabs = {} as Record<TabPath, number>
  visits: number[] = []
  cursor = 0

  constructor(route: string) {
    for (const tab of tabPaths) this.tabs[tab] = this.create(tab, tab).id
    const tab = routeTab(route)
    const page =
      route === tab ? this.pages[this.tabs[tab]]! : this.create(route, tab, this.tabs[tab])
    this.tabs[tab] = page.id
    this.visits = [page.id]
  }

  private create(route: string, tab: TabPath, parent?: number) {
    const page: PageState = { id: this.pages.length, route, tab, parent }
    this.pages.push(page)
    return page
  }

  get current(): PageState {
    return this.pages[this.visits[this.cursor]]!
  }

  private visit(id: number) {
    this.visits.splice(this.cursor + 1)
    this.visits.push(id)
    this.cursor++
    this.tabs[this.current.tab] = id
    return this.current
  }

  open(route: string) {
    if (route === this.current.route) return this.current
    if (tabPaths.includes(route as TabPath)) {
      // Explicit links to a list open that tab's root; tab controls use selectTab.
      const tab = route as TabPath
      return this.visit(this.create(route, tab).id)
    }
    return this.visit(this.create(route, this.current.tab, this.current.id).id)
  }

  selectTab(tab: TabPath) {
    return this.current.tab === tab ? this.current : this.visit(this.tabs[tab])
  }

  openRoot(tab: TabPath) {
    let page = this.pages[this.tabs[tab]]!
    while (page.parent !== undefined) page = this.pages[page.parent]!
    return this.current.id === page.id ? page : this.visit(page.id)
  }

  get parent() {
    return this.current.parent === undefined ? undefined : this.pages[this.current.parent]
  }

  /** Use native history when the parent is still reachable, including across tab switches. */
  backDistance() {
    const parent = this.parent
    if (!parent) return 0
    const index = this.visits.lastIndexOf(parent.id, this.cursor - 1)
    return index < 0 ? 0 : index - this.cursor
  }

  back() {
    const parent = this.parent
    return parent ? this.visit(parent.id) : this.current
  }

  restore(cursor: number, id: number) {
    if (this.visits[cursor] !== id || !this.pages[id]) return false
    this.cursor = cursor
    this.tabs[this.current.tab] = id
    return true
  }
}
