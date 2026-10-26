<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import {
  BookOpen,
  Layers,
  Search,
  ArrowRight,
  Bookmark,
  BrainCircuit,
  Download,
  CircleCheck,
  Moon,
  Sun,
  ChevronRight,
  ArrowUpRight,
  Check,
  X,
  Code2,
  Sparkles,
  WifiOff,
  RefreshCw,
  Upload,
  ChevronLeft,
  Clock3,
  ArrowLeft,
  List,
  HardDrive,
  Info,
  FileText,
  ExternalLink,
  Settings,
  Flag,
} from '@lucide/vue'
import NoteFilters from './components/NoteFilters.vue'
import QuestionRow from './components/QuestionRow.vue'
import Sources from './components/Sources.vue'
import GrowthPlan from './components/GrowthPlan.vue'
import KnowledgeLibrary from './components/KnowledgeLibrary.vue'
import { articles, questions, domains, matchesSearch } from './lib/content'
import { emptyNoteFilters, matchesNoteFilters, noteLocation, noteTypeLabels } from './lib/notes'
import { createLearningStore, parseBackup } from './lib/storage'
import { usePwa } from './lib/pwa'
import { getConnectivityStatus } from './lib/connectivity'
import { Navigation, type TabPath } from './lib/navigation'
import { planCases, planTasks } from './lib/plan'
import type {
  Backup,
  ContentKind,
  LearningRecord,
  Mastery,
  ReviewState,
  PlanKind,
  PlanRecord,
} from './types'

const document = window.document
const location = window.location
const baseUrl = import.meta.env.BASE_URL
const readRoute = () => {
  try {
    return decodeURIComponent(location.hash.slice(1) || '/plan')
  } catch {
    return '/not-found'
  }
}
let navigation = new Navigation(readRoute())
try {
  const saved = JSON.parse(sessionStorage.getItem('betterself-navigation-v1') || 'null')
  const marker = history.state?.betterselfPage
  if (saved && Array.isArray(saved.pages) && Array.isArray(saved.visits) && marker) {
    const candidate = Object.assign(new Navigation('/'), saved)
    candidate.repairTabs()
    if (candidate.restore(marker.cursor, marker.id) && candidate.current.route === readRoute())
      navigation = candidate
  }
} catch {
  /* Navigation also works when session storage is unavailable. */
}
history.scrollRestoration = 'manual'
const currentPage = ref(navigation.current)
const route = ref(currentPage.value.route)
const records = ref<Record<string, LearningRecord>>({})
const planRecords = ref<Record<string, PlanRecord>>({})
const planPending = ref<Record<string, number>>({})
const planErrors = ref<Record<string, boolean>>({})
const planRevisions: Record<string, number> = {}
const ready = ref(false)
const storageError = ref('')
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout>
const query = ref('')
const noteFilters = ref(emptyNoteFilters())
const searchFilters = ref(emptyNoteFilters())
const searchScope = ref<'article' | 'question' | 'case'>('article')
const practiceFilter = ref('all')
const reviewKind = ref<'article' | 'question'>('article')
const reviewFilter = ref<ReviewState>('active')
const revealed = ref(false)
const readProgress = ref(0)
const restoring = ref(false)
const fontSize = ref(18)
const theme = ref('light')
const store = createLearningStore()
const writes = new Set<Promise<unknown>>()
const fileInput = ref<HTMLInputElement>()
const importDialog = ref<HTMLDialogElement>()
const installDialog = ref<HTMLDialogElement>()
const importPreview = ref<Backup | null>(null)
const importing = ref(false)
const updating = ref(false)
const version = __APP_VERSION__
const isDev = import.meta.env.DEV
const {
  online,
  installed,
  offlineReady,
  needRefresh,
  registrationError,
  install,
  updateServiceWorker,
} = usePwa()

const nav = [
  { path: '/plan', title: '计划', icon: Flag },
  { path: '/', title: '知识', icon: BookOpen },
  { path: '/practice', title: '训练', icon: Layers },
  { path: '/search', title: '搜索', icon: Search },
]
const articleRoute = computed(() => route.value.match(/^\/article\/([^/]+)(\/original)?$/))
const currentArticle = computed(() =>
  articleRoute.value ? articles.find((item) => item.id === articleRoute.value![1]) : undefined,
)
const isOriginalView = computed(() => articleRoute.value?.[2] === '/original')
const relatedQuestion = computed(() =>
  currentArticle.value
    ? questions.find((question) => question.articleIds.includes(currentArticle.value!.id))
    : undefined,
)
const currentQuestion = computed(() =>
  route.value.startsWith('/practice/')
    ? questions.find((item) => item.id === route.value.slice(10))
    : undefined,
)
const activePath = computed(() => currentPage.value.tab)
const isDetail = computed(() => currentPage.value.parent !== undefined && route.value !== '/review')
function routeTitle(target: string) {
  const domainId = target.match(/^\/library\/topic\/([^/]+)$/)?.[1]
  const week = Number(target.match(/^\/plan\/week\/(\d+)$/)?.[1])
  const caseId = target.match(/^\/plan\/cases\/([^/]+)$/)?.[1]
  if (domainId) return domains.find((item) => item.id === domainId)?.title
  if (week) return planTasks.find((item) => item.week === week)?.title
  if (caseId) return planCases.find((item) => item.id === caseId)?.title
  return (
    (
      {
        '/plan/roadmap': '行动路线',
        '/plan/cases': '经验案例',
        '/library/all': '全部笔记',
        '/library/recent': '最近更新',
        '/library/favorites': '我的收藏',
        '/library/unverified': '待复核',
        '/library/history': '历史资料',
        '/review': '待复习',
        '/settings': '设置与备份',
      } as Record<string, string>
    )[target] || nav.find((item) => item.path === target)?.title
  )
}
const backLabel = computed(() => {
  const parentRoute = navigation.pages[currentPage.value.parent!]?.route
  return (
    articles.find((item) => parentRoute === `/article/${item.id}`)?.title ||
    questions.find((item) => parentRoute === `/practice/${item.id}`)?.title ||
    routeTitle(parentRoute) ||
    '上一页'
  )
})
const pageTitle = computed(
  () =>
    (currentArticle.value
      ? `${isOriginalView.value ? '原文 · ' : ''}${currentArticle.value.title}`
      : undefined) ||
    currentQuestion.value?.title ||
    routeTitle(route.value) ||
    '页面未找到',
)
const masteryLabels: Record<Mastery, string> = {
  unknown: '不会',
  uncertain: '模糊',
  mastered: '掌握',
}
const ratedCount = computed(
  () => questions.filter((item) => records.value[item.id]?.mastery).length,
)
const weakQuestions = computed(() =>
  questions.filter((item) =>
    ['unknown', 'uncertain'].includes(records.value[item.id]?.mastery || ''),
  ),
)
const populatedDomains = computed(() =>
  domains.filter((domain) => articles.some((article) => article.domainId === domain.id)),
)
function clearSearch() {
  query.value = ''
  searchFilters.value = emptyNoteFilters()
}
const visibleQuestions = computed(() =>
  questions.filter(
    (item) =>
      practiceFilter.value === 'all' ||
      (practiceFilter.value === 'favorites' && records.value[item.id]?.favorite) ||
      (practiceFilter.value === 'unrated'
        ? !records.value[item.id]?.mastery
        : records.value[item.id]?.mastery === practiceFilter.value),
  ),
)
const reviewQuestions = computed(() =>
  questions.filter((item) => records.value[item.id]?.reviewState === reviewFilter.value),
)
const reviewArticles = computed(() =>
  articles.filter((item) => records.value[item.id]?.reviewState === reviewFilter.value),
)
const activeReviewCount = computed(
  () =>
    [...articles, ...questions].filter((item) => records.value[item.id]?.reviewState === 'active')
      .length,
)
const foundArticles = computed(() =>
  articles.filter(
    (item) =>
      matchesSearch(item.searchText, query.value) && matchesNoteFilters(item, searchFilters.value),
  ),
)
const foundQuestions = computed(() =>
  questions.filter((item) => matchesSearch(item.searchText, query.value)),
)
const foundCases = computed(() =>
  planCases.filter((item) =>
    matchesSearch(
      [item.title, item.description, ...item.prompts, planRecords.value[item.id]?.notes || ''].join(
        ' ',
      ),
      query.value,
    ),
  ),
)
const nextQuestion = computed(
  () => questions.find((item) => records.value[item.id]?.mastery !== 'mastered') || questions[0],
)
const questionIndex = computed(() =>
  questions.findIndex((item) => item.id === currentQuestion.value?.id),
)
const connectivity = computed(() =>
  getConnectivityStatus({
    online: online.value,
    isDev,
    registrationError: registrationError.value,
    offlineReady: offlineReady.value,
  }),
)
const validPage = computed(
  () =>
    [
      '/',
      '/plan',
      '/plan/roadmap',
      '/plan/cases',
      '/practice',
      '/review',
      '/search',
      '/settings',
    ].includes(route.value) ||
    /^\/plan\/week\/(?:[1-9]|1\d|2[0-4])$/.test(route.value) ||
    planCases.some((item) => route.value === `/plan/cases/${item.id}`) ||
    domains.some((item) => route.value === `/library/topic/${item.id}`) ||
    /^\/library\/(?:all|recent|favorites|unverified|history)$/.test(route.value) ||
    (!!currentArticle.value && (!isOriginalView.value || !!currentArticle.value.original)) ||
    !!currentQuestion.value,
)

function notify(message: string) {
  toast.value = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.value = ''
  }, 3500)
}

async function save(
  id: string,
  kind: ContentKind,
  patch: Partial<
    Pick<LearningRecord, 'mastery' | 'favorite' | 'progress' | 'lastViewedAt' | 'reviewState'>
  >,
) {
  if (!ready.value) {
    notify('学习记录暂不可用，请检查页面上方提示。')
    return false
  }
  const task = store.update(id, kind, patch)
  writes.add(task)
  try {
    const record = await task
    records.value[id] = record
    return true
  } catch {
    storageError.value = '这次记录未能保存。请保留页面，并检查浏览器是否允许保存网站数据。'
    return false
  } finally {
    writes.delete(task)
  }
}

async function favorite(id: string, kind: ContentKind) {
  const value = !records.value[id]?.favorite
  if (await save(id, kind, { favorite: value })) notify(value ? '已加入收藏' : '已取消收藏')
}
async function savePlan(
  id: string,
  kind: PlanKind,
  patch: Partial<Pick<PlanRecord, 'status' | 'notes' | 'articleIds' | 'questionIds'>>,
) {
  if (!ready.value) return
  const revision = (planRevisions[id] || 0) + 1
  planRevisions[id] = revision
  // Keep the latest typed text visible while earlier IndexedDB writes finish.
  const current = planRecords.value[id] || {
    id,
    kind,
    status: 'todo' as const,
    notes: '',
    articleIds: [],
    questionIds: [],
    updatedAt: '',
  }
  planRecords.value[id] = { ...current, ...patch, updatedAt: new Date().toISOString() }
  planPending.value[id] = (planPending.value[id] || 0) + 1
  const snapshot = planRecords.value[id]!
  const task = store.updatePlan(id, kind, {
    notes: snapshot.notes,
    status: snapshot.status,
    articleIds: snapshot.articleIds,
    questionIds: snapshot.questionIds,
  })
  writes.add(task)
  try {
    const record = await task
    if (planRevisions[id] === revision) {
      planRecords.value[id] = record
      delete planErrors.value[id]
    }
  } catch {
    if (planRevisions[id] === revision) planErrors.value[id] = true
  } finally {
    planPending.value[id] = (planPending.value[id] || 1) - 1
    writes.delete(task)
  }
}
function retryPlan(id: string) {
  const record = planRecords.value[id]
  if (record)
    void savePlan(id, record.kind, {
      notes: record.notes,
      status: record.status,
      articleIds: record.articleIds,
      questionIds: record.questionIds,
    })
}

async function loadRecords() {
  const [learning, plan] = await Promise.all([store.all(), store.allPlan()])
  records.value = Object.fromEntries(learning.map((record) => [record.id, record]))
  planRecords.value = Object.fromEntries(plan.map((record) => [record.id, record]))
}
async function setReview(id: string, kind: ContentKind, reviewState: ReviewState) {
  if (await save(id, kind, { reviewState }))
    notify(
      reviewState === 'active'
        ? '已加入复习'
        : reviewState === 'completed'
          ? '已完成本次复习'
          : '已移出复习',
    )
}
function openSearch() {
  capturePage()
  navigation.openRoot('/search')
  writeHistory()
  showPage()
  void nextTick(() => document.querySelector<HTMLInputElement>('#site-search')?.focus())
}

function persistNavigation() {
  try {
    sessionStorage.setItem('betterself-navigation-v1', JSON.stringify(navigation))
  } catch {
    /* Optional session cache. */
  }
}
function capturePage() {
  void saveReading()
  if (!restoring.value) currentPage.value.scroll = window.scrollY
  currentPage.value.revealed = revealed.value
  currentPage.value.view = JSON.parse(
    JSON.stringify({
      query: query.value,
      noteFilters: noteFilters.value,
      searchFilters: searchFilters.value,
      searchScope: searchScope.value,
      practiceFilter: practiceFilter.value,
      reviewKind: reviewKind.value,
      reviewFilter: reviewFilter.value,
    }),
  )
}
function writeHistory(replace = false) {
  const state = {
    ...history.state,
    betterselfPage: { id: navigation.current.id, cursor: navigation.cursor },
  }
  history[replace ? 'replaceState' : 'pushState'](state, '', `#${navigation.current.route}`)
  persistNavigation()
}
function showPage() {
  currentPage.value = navigation.current
  route.value = navigation.current.route
  persistNavigation()
  void activateRoute()
}
function navigate(path: string, replace = false) {
  capturePage()
  navigation.open(path)
  writeHistory(replace)
  showPage()
}
function switchTab(path: string) {
  if (activePath.value === path) return
  capturePage()
  navigation.selectTab(path as TabPath)
  writeHistory()
  showPage()
}
function goBack() {
  capturePage()
  const distance = navigation.backDistance()
  if (distance) {
    history.go(distance)
    return
  }
  navigation.back()
  writeHistory()
  showPage()
}
function onInternalLink(event: MouseEvent) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return
  const anchor = (event.target as Element).closest<HTMLAnchorElement>('a[href]')
  const href = anchor?.getAttribute('href')
  if (!href?.startsWith('#/') || anchor?.target || anchor?.hasAttribute('download')) return
  event.preventDefault()
  try {
    navigate(decodeURIComponent(href.slice(1)))
  } catch {
    navigate('/not-found')
  }
}
function saveSession() {
  capturePage()
  persistNavigation()
}

let scrollTimer: ReturnType<typeof setTimeout> | undefined
let activation = 0
function saveReading() {
  clearTimeout(scrollTimer)
  const article = isOriginalView.value ? undefined : currentArticle.value
  if (article && ready.value && !restoring.value)
    return save(article.id, 'article', { progress: readProgress.value })
}
function onScroll() {
  if (!restoring.value) currentPage.value.scroll = window.scrollY
  if (!currentArticle.value || isOriginalView.value || !ready.value || restoring.value) return
  const max = document.documentElement.scrollHeight - innerHeight
  readProgress.value = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 1
  clearTimeout(scrollTimer)
  scrollTimer = setTimeout(() => {
    void saveReading()
  }, 250)
}
async function activateRoute() {
  const token = ++activation
  const page = currentPage.value
  const view = page.view
  if (view) {
    query.value = view.query as string
    noteFilters.value = view.noteFilters as ReturnType<typeof emptyNoteFilters>
    searchFilters.value = view.searchFilters as ReturnType<typeof emptyNoteFilters>
    searchScope.value = view.searchScope as 'article' | 'question' | 'case'
    practiceFilter.value = view.practiceFilter as string
    reviewKind.value = view.reviewKind as 'article' | 'question'
    reviewFilter.value = view.reviewFilter as ReviewState
  }
  revealed.value = page.revealed || false
  const article = isOriginalView.value ? undefined : currentArticle.value
  const savedProgress = article ? records.value[article.id]?.progress || 0 : 0
  restoring.value = true
  await nextTick()
  if (token !== activation) return
  window.scrollTo(
    0,
    page.scroll ??
      (article
        ? savedProgress * Math.max(0, document.documentElement.scrollHeight - innerHeight)
        : 0),
  )
  const maxScroll = Math.max(0, document.documentElement.scrollHeight - innerHeight)
  readProgress.value =
    page.scroll === undefined
      ? savedProgress
      : maxScroll > 0
        ? Math.min(1, window.scrollY / maxScroll)
        : 1
  document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true })
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      if (token === activation) restoring.value = false
    }),
  )
  if (article && ready.value)
    await save(article.id, 'article', { lastViewedAt: new Date().toISOString() })
  if (route.value === '/search' && page.scroll === undefined)
    await nextTick(() => document.querySelector<HTMLInputElement>('#site-search')?.focus())
}
function onHashChange() {
  const marker = history.state?.betterselfPage
  if (marker && marker.id === currentPage.value.id && readRoute() === route.value) return
  capturePage()
  if (
    marker &&
    navigation.restore(marker.cursor, marker.id) &&
    navigation.current.route === readRoute()
  )
    showPage()
  else navigate(readRoute(), true)
}
function onVisibilityChange() {
  if (document.visibilityState === 'hidden') saveSession()
}
watch(
  pageTitle,
  (title) => {
    document.title = `${title} · BetterSelf`
  },
  { immediate: true },
)

async function revealAnswer() {
  revealed.value = true
  const question = currentQuestion.value
  if (question) await save(question.id, 'question', { lastViewedAt: new Date().toISOString() })
}
async function rate(mastery: Mastery) {
  const question = currentQuestion.value
  if (question && revealed.value && (await save(question.id, 'question', { mastery })))
    notify(`已标记为“${masteryLabels[mastery]}”`)
}
function changeFont(delta: number) {
  void saveReading()
  fontSize.value = Math.min(24, Math.max(16, fontSize.value + delta))
  try {
    localStorage.setItem('betterself-font-size', String(fontSize.value))
  } catch {
    /* 阅读设置允许在当前页面继续使用。 */
  }
}
function toggleTheme() {
  theme.value = theme.value === 'light' ? 'dark' : 'light'
  document.documentElement.dataset.theme = theme.value
  try {
    localStorage.setItem('betterself-theme', theme.value)
  } catch {
    /* 本次主题选择仍生效。 */
  }
}
async function requestInstall() {
  try {
    if (!(await install())) installDialog.value?.showModal()
  } catch {
    notify('安装未完成，可以稍后从浏览器菜单重试。')
  }
}
async function applyUpdate() {
  updating.value = true
  const readingSaved = await saveReading()
  const results = await Promise.allSettled([...writes])
  if (
    readingSaved === false ||
    storageError.value ||
    Object.keys(planErrors.value).length ||
    results.some((result) => result.status === 'rejected')
  ) {
    updating.value = false
    notify('请先确认学习记录已保存，再更新。')
    return
  }
  try {
    await updateServiceWorker(true)
  } catch {
    updating.value = false
    notify('更新未完成，请联网后重试。')
  }
}
async function exportBackup() {
  try {
    const readingSaved = await saveReading()
    const results = await Promise.allSettled([...writes])
    if (
      readingSaved === false ||
      storageError.value ||
      Object.keys(planErrors.value).length ||
      results.some((result) => result.status === 'rejected')
    ) {
      notify('有记录尚未保存，请先重试保存后再导出。')
      return
    }
    const backup = await store.export()
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }),
    )
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `BetterSelf-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    notify('备份已导出，可保存到其他设备。')
  } catch {
    notify('备份未能导出，请稍后重试。')
  }
}
async function chooseImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (file.size > 5_000_000) {
    notify('请选择 5 MB 以内的备份文件。')
    return
  }
  try {
    importPreview.value = parseBackup(await file.text())
    importDialog.value?.showModal()
  } catch (error) {
    notify(error instanceof Error ? error.message : '备份文件读取失败。')
  }
}
async function confirmImport() {
  if (!importPreview.value) return
  importing.value = true
  try {
    await Promise.all([...writes])
    if (Object.keys(planErrors.value).length) {
      notify('请先在成长计划中重试保存，再合并备份。')
      return
    }
    const count = await store.import(importPreview.value)
    await loadRecords()
    importDialog.value?.close()
    importPreview.value = null
    notify(`已合并 ${count} 条较新的记录。`)
  } catch {
    notify('导入未完成，原有记录已保留，请稍后重试。')
  } finally {
    importing.value = false
  }
}
function cancelImport() {
  importDialog.value?.close()
  importPreview.value = null
}
function keyboardShortcut(event: KeyboardEvent) {
  const tag = (event.target as HTMLElement)?.tagName
  if (
    ((event.metaKey || event.ctrlKey) && event.key === 'k') ||
    (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(tag))
  ) {
    event.preventDefault()
    openSearch()
  }
}
onMounted(async () => {
  try {
    theme.value = localStorage.getItem('betterself-theme') === 'dark' ? 'dark' : 'light'
    const storedFont = Number(localStorage.getItem('betterself-font-size'))
    if (storedFont >= 16 && storedFont <= 24) fontSize.value = storedFont
  } catch {
    /* 浏览器禁用设置保存时使用默认样式。 */
  }
  document.documentElement.dataset.theme = theme.value
  window.addEventListener('hashchange', onHashChange)
  window.addEventListener('popstate', onHashChange)
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('pagehide', saveSession)
  window.addEventListener('keydown', keyboardShortcut)
  document.addEventListener('visibilitychange', onVisibilityChange)
  try {
    await loadRecords()
    ready.value = true
  } catch {
    storageError.value = '当前浏览器无法保存学习记录。文章仍可阅读，请允许网站存储后重新打开。'
  }
  writeHistory(true)
  await activateRoute()
})
onUnmounted(() => {
  window.removeEventListener('hashchange', onHashChange)
  window.removeEventListener('popstate', onHashChange)
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('pagehide', saveSession)
  window.removeEventListener('keydown', keyboardShortcut)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  clearTimeout(scrollTimer)
  clearTimeout(toastTimer)
  void store.close()
})
</script>

<template>
  <a
    class="skip-link"
    href="#main-content"
    @click.prevent="document.getElementById('main-content')?.focus()"
    >跳到主要内容</a
  >
  <div class="app-shell" @click="onInternalLink">
    <aside class="sidebar">
      <a href="#/plan" class="brand"
        ><img :src="`${baseUrl}favicon.svg`" width="34" height="34" alt="" /><span
          >BetterSelf<span class="brand-period">.</span></span
        ></a
      >
      <div class="sidebar-label">我的学习空间</div>
      <nav class="desktop-nav" aria-label="主要导航">
        <a
          v-for="item in nav"
          :key="item.path"
          :href="`#${item.path}`"
          @click.prevent="switchTab(item.path)"
          :class="{ active: activePath === item.path }"
          :aria-current="activePath === item.path ? 'page' : undefined"
          ><component :is="item.icon" :size="19" /><span>{{ item.title }}</span
          ><span v-if="item.path === '/practice' && activeReviewCount" class="nav-count">{{
            activeReviewCount
          }}</span></a
        >
      </nav>
      <div class="sidebar-separator"></div>
      <div class="sidebar-label">笔记主题</div>
      <a
        v-for="domain in populatedDomains"
        :key="domain.id"
        :href="`#/library/topic/${domain.id}`"
        class="sidebar-topic"
      >
        <span class="topic-dot"></span><span>{{ domain.title }}</span
        ><span class="sidebar-topic-count">{{
          articles.filter((article) => article.domainId === domain.id).length
        }}</span>
      </a>
      <div class="sidebar-bottom">
        <div class="sidebar-note">
          <div class="note-icon"><Sparkles :size="18" /></div>
          <h3>每一小步，都算数。</h3>
          <p>留下经验，常常回顾。<br />把学过的，变成自己的。</p>
        </div>
        <a href="#/settings" class="local-data-link"
          ><HardDrive :size="14" /> 设置与备份 <ChevronRight :size="13" /></a
        ><span class="sidebar-version">BETTERSELF / {{ version }}</span>
      </div>
    </aside>

    <div class="workspace">
      <header class="topbar" :class="{ 'detail-header': isDetail }">
        <div class="desktop-breadcrumb">
          我的学习空间 <ChevronRight :size="13" /><span>{{ pageTitle }}</span>
        </div>
        <div v-if="isDetail" class="mobile-page-header">
          <button class="icon-button" :aria-label="`返回${backLabel}`" @click="goBack">
            <ArrowLeft :size="22" />
          </button>
          <div>
            <span>{{ nav.find((item) => item.path === activePath)?.title }}</span
            ><strong>{{ pageTitle }}</strong>
          </div>
        </div>
        <a v-else href="#/plan" class="mobile-brand"
          ><img :src="`${baseUrl}favicon.svg`" alt="" width="28" height="28" />BetterSelf<span
            >.</span
          ></a
        >
        <div class="topbar-actions">
          <button class="header-search" @click="openSearch">
            <Search :size="16" /><span>搜索笔记、面试题…</span><kbd>⌘ K</kbd></button
          ><span class="online-badge" :class="{ offline: !online }"
            ><WifiOff v-if="!online" :size="13" /><span v-else class="status-dot"></span
            >{{ connectivity.badge }}</span
          ><a href="#/settings" class="icon-button" aria-label="设置与备份"
            ><Settings :size="19" /></a
          ><button
            class="icon-button theme-toggle"
            :aria-label="theme === 'light' ? '切换深色模式' : '切换浅色模式'"
            @click="toggleTheme"
          >
            <Moon v-if="theme === 'light'" :size="19" /><Sun v-else :size="19" />
          </button>
        </div>
      </header>

      <div v-if="storageError" class="notice error-notice" role="alert">{{ storageError }}</div>
      <div v-if="Object.keys(planErrors).length" class="notice error-notice" role="alert">
        <span>有成长计划记录尚未保存，草稿仍保留在当前页面。</span>
        <button class="text-link" @click="Object.keys(planErrors).forEach(retryPlan)">
          重试保存
        </button>
      </div>
      <div v-if="needRefresh" class="notice update-notice" role="status">
        <RefreshCw :size="17" /><span>有新的内容与功能可以使用。</span
        ><button class="text-link" :disabled="updating" @click="applyUpdate">
          {{ updating ? '正在更新…' : '保存进度并更新' }}
        </button>
      </div>
      <div v-if="!online" class="notice offline-notice" role="status">
        <WifiOff :size="16" /><span>{{
          offlineReady
            ? '正在使用已缓存的内容，学习记录会继续保存在这台设备。'
            : '当前没有网络，已打开的内容仍可阅读。'
        }}</span>
      </div>

      <main
        :key="currentPage.id"
        id="main-content"
        class="main-content"
        :class="{ 'detail-page': isDetail }"
        tabindex="-1"
      >
        <KnowledgeLibrary
          v-if="route === '/' || route.startsWith('/library/')"
          v-model:filters="noteFilters"
          :route="route"
          :records="records"
          @favorite="favorite($event, 'article')"
          @search="openSearch"
          @back="goBack"
        />

        <template v-else-if="currentArticle && isOriginalView && currentArticle.original">
          <div class="detail-topline">
            <button class="subtle-link page-back" @click="goBack">
              <ArrowLeft :size="16" /> 返回{{ backLabel }}
            </button>
            <span class="source-version-label">原始版本</span>
          </div>
          <div class="original-layout">
            <article class="panel article-detail original-detail">
              <div class="original-notice">
                <FileText :size="20" />
                <div>
                  <strong>这是迁移时保留的原文</strong>
                  <p>
                    由有道云笔记官方 Word 导出转换，正文未经本轮整理；版式可能与有道编辑器略有不同。
                  </p>
                </div>
              </div>
              <div class="detail-heading original-heading">
                <div class="card-eyebrow">原始标题 · {{ currentArticle.original.title }}</div>
                <h1 tabindex="-1">{{ currentArticle.original.title }}</h1>
                <div class="article-detail-meta">
                  <span><Clock3 :size="14" /> {{ currentArticle.original.minutes }} 分钟</span>
                  <span>原记录更新 {{ currentArticle.original.updatedAt }}</span>
                </div>
              </div>
              <details v-if="currentArticle.original.toc.length" class="mobile-toc">
                <summary><List :size="17" /> 原文目录</summary>
                <button
                  v-for="heading in currentArticle.original.toc"
                  :key="heading.id"
                  @click="document.getElementById(heading.id)?.scrollIntoView()"
                >
                  {{ heading.title }}
                </button>
              </details>
              <div
                class="prose article-prose original-prose"
                :style="{ fontSize: `${fontSize}px` }"
                v-html="currentArticle.original.html"
              ></div>
              <section class="organized-return">
                <span class="eyebrow">整理后的阅读版本</span>
                <h2>{{ currentArticle.title }}</h2>
                <button class="secondary-button" @click="goBack">
                  返回整理稿 <ArrowLeft :size="16" />
                </button>
              </section>
            </article>
            <aside v-if="currentArticle.original.toc.length" class="article-toc original-toc">
              <span class="eyebrow">原文目录</span>
              <button
                v-for="(heading, index) in currentArticle.original.toc"
                :key="heading.id"
                @click="document.getElementById(heading.id)?.scrollIntoView()"
              >
                <span>{{ String(index + 1).padStart(2, '0') }}</span
                >{{ heading.title }}
              </button>
            </aside>
          </div>
        </template>

        <template v-else-if="currentArticle && !isOriginalView">
          <div class="detail-topline">
            <button class="subtle-link page-back" @click="goBack">
              <ArrowLeft :size="16" /> 返回{{ backLabel }}</button
            ><span class="muted small">已读 {{ Math.round(readProgress * 100) }}%</span>
          </div>
          <div class="detail-layout">
            <article class="panel article-detail">
              <div class="detail-heading">
                <div class="card-eyebrow">
                  {{ noteLocation(currentArticle, domains) }} ·
                  {{ noteTypeLabels[currentArticle.noteType] }}
                  <span v-if="currentArticle.sample" class="sample-label">示例内容</span>
                </div>
                <h1 tabindex="-1">{{ currentArticle.title }}</h1>
                <p>{{ currentArticle.summary }}</p>
                <div class="article-detail-meta">
                  <span><Clock3 :size="14" /> {{ currentArticle.minutes }} 分钟</span
                  ><span>更新 {{ currentArticle.updatedAt }}</span>
                </div>
                <div class="reading-toolbar">
                  <div class="font-controls">
                    <span>字号</span
                    ><button
                      aria-label="缩小字号"
                      :disabled="fontSize <= 16"
                      @click="changeFont(-1)"
                    >
                      A−</button
                    ><span>{{ fontSize }}</span
                    ><button
                      aria-label="放大字号"
                      :disabled="fontSize >= 24"
                      @click="changeFont(1)"
                    >
                      A+
                    </button>
                  </div>
                  <button
                    class="subtle-link"
                    :class="{ bookmarked: records[currentArticle.id]?.favorite }"
                    :aria-pressed="!!records[currentArticle.id]?.favorite"
                    @click="favorite(currentArticle.id, 'article')"
                  >
                    <Bookmark
                      :size="17"
                      :fill="records[currentArticle.id]?.favorite ? 'currentColor' : 'none'"
                    />{{ records[currentArticle.id]?.favorite ? '已收藏' : '收藏笔记' }}
                  </button>
                  <button
                    class="subtle-link"
                    :disabled="!ready"
                    :aria-pressed="records[currentArticle.id]?.reviewState === 'active'"
                    @click="
                      setReview(
                        currentArticle.id,
                        'article',
                        records[currentArticle.id]?.reviewState === 'active' ? 'none' : 'active',
                      )
                    "
                  >
                    <BrainCircuit :size="17" />{{
                      records[currentArticle.id]?.reviewState === 'active' ? '移出复习' : '加入复习'
                    }}
                  </button>
                  <a
                    v-if="currentArticle.original"
                    :href="`#/article/${currentArticle.id}/original`"
                    class="subtle-link"
                  >
                    <FileText :size="17" /> 原文对照
                  </a>
                </div>
              </div>
              <details class="mobile-toc">
                <summary><List :size="17" /> 本文目录</summary>
                <button
                  v-for="heading in currentArticle.toc"
                  :key="heading.id"
                  @click="document.getElementById(heading.id)?.scrollIntoView()"
                >
                  {{ heading.title }}
                </button>
              </details>
              <div
                class="prose article-prose"
                :style="{ fontSize: `${fontSize}px` }"
                v-html="currentArticle.html"
              ></div>
              <a
                v-if="currentArticle.original"
                :href="`#/article/${currentArticle.id}/original`"
                class="source-compare-card"
              >
                <span class="source-compare-icon"><FileText :size="21" /></span>
                <span>
                  <strong>查看原文对照</strong>
                  <small>{{ currentArticle.original.title }} · 未整理版本</small>
                </span>
                <ChevronRight :size="19" />
              </a>
              <Sources
                :sources="currentArticle.sources"
                :applicability="currentArticle.applicability"
                :verified-at="currentArticle.verifiedAt"
              />
              <section v-if="relatedQuestion" class="related-section">
                <h2>关联面试题</h2>
                <a :href="`#/practice/${relatedQuestion.id}`" class="subtle-link"
                  >查看关联题目 <ArrowRight :size="16"
                /></a>
              </section>
            </article>
            <aside class="article-toc">
              <span class="eyebrow">本文目录</span
              ><button
                v-for="(heading, index) in currentArticle.toc"
                :key="heading.id"
                @click="document.getElementById(heading.id)?.scrollIntoView()"
              >
                <span>{{ String(index + 1).padStart(2, '0') }}</span
                >{{ heading.title }}
              </button>
              <div class="toc-note">
                <Sparkles :size="18" />
                <p>读完以后，试着用自己的话讲一次。</p>
              </div>
            </aside>
          </div>
        </template>

        <template v-else-if="route === '/practice'">
          <nav class="training-tabs" aria-label="训练内容">
            <a href="#/practice" class="active" aria-current="page">面试练习</a>
            <a href="#/review"
              >待复习 <span v-if="activeReviewCount">{{ activeReviewCount }}</span></a
            >
          </nav>
          <div class="page-heading">
            <div class="eyebrow">从知道，到说得清楚</div>
            <h1 tabindex="-1">面试练习<span class="accent-period">。</span></h1>
            <p>先回想，再看答案。为每个问题留下真实的自我评价。</p>
          </div>
          <div class="practice-banner panel">
            <div class="practice-banner-icon"><Code2 :size="29" /></div>
            <div>
              <span class="card-eyebrow">当前专题 · 示例内容</span>
              <h2>C# 与 Unity 面试基础</h2>
              <p>
                {{ questions.length }} 道题 · 已自评 {{ ratedCount }} 道 · 待巩固
                {{ weakQuestions.length }} 道
              </p>
            </div>
            <a :href="`#/practice/${nextQuestion.id}`" class="primary-button"
              >{{ ratedCount ? '继续练习' : '开始练习' }} <ArrowRight :size="16"
            /></a>
          </div>
          <div class="section-heading question-heading">
            <h2>
              全部问题 <span class="section-count">{{ questions.length }}</span>
            </h2>
            <span class="muted small">按掌握程度筛选</span>
          </div>
          <div class="filter-tabs">
            <button
              v-for="filter in [
                { id: 'all', label: '全部' },
                { id: 'unrated', label: '未自评' },
                { id: 'favorites', label: '已收藏' },
                { id: 'unknown', label: '不会' },
                { id: 'uncertain', label: '模糊' },
                { id: 'mastered', label: '掌握' },
              ]"
              :key="filter.id"
              :class="{ selected: practiceFilter === filter.id }"
              :aria-pressed="practiceFilter === filter.id"
              @click="practiceFilter = filter.id"
            >
              {{ filter.label }}
            </button>
          </div>
          <div v-if="visibleQuestions.length" class="panel question-list">
            <QuestionRow
              v-for="question in visibleQuestions"
              :key="question.id"
              :question="question"
              :record="records[question.id]"
              :number="questions.indexOf(question) + 1"
              @favorite="favorite($event, 'question')"
            />
          </div>
          <div v-else class="panel empty-state">
            <Layers :size="30" />
            <h2>这个分组还没有题目</h2>
            <p>完成自评后，题目会出现在对应分组。</p>
            <button class="secondary-button" @click="practiceFilter = 'all'">查看全部问题</button>
          </div>
        </template>

        <template v-else-if="currentQuestion">
          <div class="detail-topline">
            <button class="subtle-link page-back" @click="goBack">
              <ArrowLeft :size="16" /> 返回{{ backLabel }}</button
            ><span class="question-counter"
              >{{ String(questionIndex + 1).padStart(2, '0') }}
              <span>/ {{ String(questions.length).padStart(2, '0') }}</span></span
            >
          </div>
          <article class="panel question-detail">
            <div class="question-detail-header">
              <div class="card-eyebrow">
                <span class="level-label">{{ currentQuestion.level }}</span
                ><span v-if="currentQuestion.sample" class="sample-label">示例内容</span
                ><span class="question-topic">{{ currentQuestion.tags.join(' / ') }}</span>
              </div>
              <button
                class="icon-button"
                :class="{ bookmarked: records[currentQuestion.id]?.favorite }"
                :aria-label="
                  records[currentQuestion.id]?.favorite ? '取消收藏这道题' : '收藏这道题'
                "
                :aria-pressed="!!records[currentQuestion.id]?.favorite"
                @click="favorite(currentQuestion.id, 'question')"
              >
                <Bookmark
                  :size="20"
                  :fill="records[currentQuestion.id]?.favorite ? 'currentColor' : 'none'"
                />
              </button>
            </div>
            <h1 tabindex="-1">{{ currentQuestion.title }}</h1>
            <div v-if="!revealed" class="think-first">
              <div class="thinking-icon"><BrainCircuit :size="30" /></div>
              <h2>先在心里，回答一次。</h2>
              <p>你会从哪里开始？能否用一个例子讲清楚？</p>
              <button class="primary-button" @click="revealAnswer">
                想好了，查看答案 <ArrowRight :size="17" /></button
              ><span>查看答案不会自动标记为已掌握</span>
            </div>
            <div v-else class="answer-content">
              <div class="short-answer">
                <span class="answer-eyebrow"><Sparkles :size="15" /> 30 秒回答</span>
                <div class="prose" v-html="currentQuestion.shortAnswerHtml"></div>
              </div>
              <section class="answer-section">
                <h2>再深入一点</h2>
                <div class="prose" v-html="currentQuestion.explanationHtml"></div>
              </section>
              <section class="answer-section pitfalls">
                <h2>容易混淆的地方</h2>
                <ul>
                  <li v-for="pitfall in currentQuestion.pitfalls" :key="pitfall">{{ pitfall }}</li>
                </ul>
              </section>
              <section class="answer-section">
                <h2>继续追问</h2>
                <ol>
                  <li v-for="followUp in currentQuestion.followUps" :key="followUp">
                    {{ followUp }}
                  </li>
                </ol>
              </section>
              <div class="related-links">
                <a v-for="id in currentQuestion.articleIds" :key="id" :href="`#/article/${id}`"
                  ><BookOpen :size="16" /> 阅读关联笔记 <ArrowUpRight :size="15"
                /></a>
              </div>
              <Sources
                :sources="currentQuestion.sources"
                :applicability="currentQuestion.applicability"
                :verified-at="currentQuestion.verifiedAt"
              />
              <div class="self-rating">
                <h2>现在，你掌握得怎么样？</h2>
                <p class="muted small">
                  标记“不会”或“模糊”会加入待巩固；标记“掌握”会完成本次复习。
                </p>
                <div class="rating-buttons">
                  <button
                    v-for="(label, key) in masteryLabels"
                    :key="key"
                    :class="[key, { chosen: records[currentQuestion.id]?.mastery === key }]"
                    :aria-pressed="records[currentQuestion.id]?.mastery === key"
                    :disabled="!ready"
                    @click="rate(key)"
                  >
                    <X v-if="key === 'unknown'" :size="17" /><RefreshCw
                      v-else-if="key === 'uncertain'"
                      :size="17"
                    /><Check v-else :size="17" />{{ label }}
                  </button>
                </div>
              </div>
            </div>
            <div class="question-pagination">
              <a
                v-if="questionIndex > 0"
                :href="`#/practice/${questions[questionIndex - 1].id}`"
                class="subtle-link"
                ><ChevronLeft :size="17" /> 上一题</a
              ><a v-else href="#/practice" class="subtle-link">题目列表</a
              ><a
                v-if="questionIndex < questions.length - 1"
                :href="`#/practice/${questions[questionIndex + 1].id}`"
                class="secondary-button"
                >下一题 <ArrowRight :size="16" /></a
              ><a v-else href="#/review" class="primary-button"
                >查看我的复习 <ArrowRight :size="16"
              /></a>
            </div>
          </article>
        </template>

        <template v-else-if="route === '/review'">
          <nav class="training-tabs" aria-label="训练内容">
            <a href="#/practice">面试练习</a>
            <a href="#/review" class="active" aria-current="page"
              >待复习 <span v-if="activeReviewCount">{{ activeReviewCount }}</span></a
            >
          </nav>
          <div class="page-heading">
            <div class="eyebrow">主动巩固，逐步积累</div>
            <h1 tabindex="-1">我的复习<span class="accent-period">。</span></h1>
            <p>笔记主动加入，题目根据自评加入；收藏和阅读不会创建复习任务。</p>
          </div>
          <div class="filter-tabs" aria-label="复习内容类型">
            <button
              :class="{ selected: reviewKind === 'article' }"
              :aria-pressed="reviewKind === 'article'"
              @click="reviewKind = 'article'"
            >
              笔记
            </button>
            <button
              :class="{ selected: reviewKind === 'question' }"
              :aria-pressed="reviewKind === 'question'"
              @click="reviewKind = 'question'"
            >
              题目
            </button>
          </div>
          <div class="filter-tabs" aria-label="复习状态">
            <button
              :class="{ selected: reviewFilter === 'active' }"
              :aria-pressed="reviewFilter === 'active'"
              @click="reviewFilter = 'active'"
            >
              待复习
            </button>
            <button
              :class="{ selected: reviewFilter === 'completed' }"
              :aria-pressed="reviewFilter === 'completed'"
              @click="reviewFilter = 'completed'"
            >
              已完成
            </button>
          </div>
          <div v-if="reviewKind === 'article' && reviewArticles.length" class="panel review-list">
            <div v-for="article in reviewArticles" :key="article.id" class="review-item">
              <a :href="`#/article/${article.id}`"
                ><h2>{{ article.title }}</h2>
                <span class="muted small"
                  >{{ noteLocation(article, domains) }} ·
                  {{ noteTypeLabels[article.noteType] }}</span
                ></a
              >
              <div class="review-actions">
                <button
                  class="secondary-button"
                  :disabled="!ready"
                  @click="
                    setReview(
                      article.id,
                      'article',
                      reviewFilter === 'active' ? 'completed' : 'active',
                    )
                  "
                >
                  {{ reviewFilter === 'active' ? '完成复习' : '再次复习' }}</button
                ><button
                  class="subtle-link"
                  :disabled="!ready"
                  @click="setReview(article.id, 'article', 'none')"
                >
                  移出复习
                </button>
              </div>
            </div>
          </div>
          <div
            v-else-if="reviewKind === 'question' && reviewQuestions.length"
            class="panel review-list"
          >
            <div v-for="question in reviewQuestions" :key="question.id" class="review-item">
              <QuestionRow
                :question="question"
                :record="records[question.id]"
                :number="questions.indexOf(question) + 1"
                @favorite="favorite($event, 'question')"
              />
              <div class="review-actions">
                <button
                  class="secondary-button"
                  :disabled="!ready"
                  @click="
                    setReview(
                      question.id,
                      'question',
                      reviewFilter === 'active' ? 'completed' : 'active',
                    )
                  "
                >
                  {{ reviewFilter === 'active' ? '完成本次复习' : '再次复习' }}</button
                ><button
                  class="subtle-link"
                  :disabled="!ready"
                  @click="setReview(question.id, 'question', 'none')"
                >
                  移出复习
                </button>
              </div>
            </div>
          </div>
          <div v-else class="panel empty-state">
            <BrainCircuit :size="32" />
            <h2>{{ reviewFilter === 'completed' ? '还没有完成的复习' : '当前没有待复习内容' }}</h2>
            <p>
              {{
                reviewKind === 'article'
                  ? '在笔记详情中选择“加入复习”，以后回到这里继续。'
                  : '将题目标记为“不会”或“模糊”，就会加入待巩固。'
              }}
            </p>
            <a :href="reviewKind === 'article' ? '#/' : '#/practice'" class="primary-button"
              >{{ reviewKind === 'article' ? '浏览笔记' : '去面试练习' }}<ArrowRight :size="16"
            /></a>
          </div>
        </template>

        <GrowthPlan
          v-else-if="route.startsWith('/plan')"
          :route="route"
          :records="planRecords"
          :ready="ready"
          :pending="planPending"
          :errors="planErrors"
          @update="savePlan"
          @retry="retryPlan"
          @back="goBack"
        />

        <template v-else-if="route === '/settings'">
          <div v-if="isDetail" class="detail-topline">
            <button class="subtle-link page-back" @click="goBack">
              <ArrowLeft :size="16" /> 返回{{ backLabel }}
            </button>
          </div>
          <div class="page-heading">
            <h1 tabindex="-1">设置与备份<span class="accent-period">。</span></h1>
            <p>阅读偏好和学习记录，由你掌握。</p>
          </div>
          <section class="panel preferences-panel">
            <h2>阅读设置</h2>
            <div class="review-actions">
              <button class="secondary-button" @click="toggleTheme">
                {{ theme === 'light' ? '切换深色模式' : '切换浅色模式' }}</button
              ><button class="secondary-button" :disabled="fontSize <= 16" @click="changeFont(-1)">
                缩小字号</button
              ><span>{{ fontSize }} px</span
              ><button class="secondary-button" :disabled="fontSize >= 24" @click="changeFont(1)">
                放大字号</button
              ><button v-if="!installed" class="secondary-button" @click="requestInstall">
                安装到桌面
              </button>
            </div>
          </section>
          <section class="panel backup-panel">
            <div class="backup-title">
              <span class="stat-icon"><HardDrive :size="22" /></span>
              <div>
                <h2>把积累，妥善保存</h2>
                <p>
                  学习记录、计划进度与案例草稿保存在这台设备。导出备份，可以带到另一台设备继续使用。
                </p>
              </div>
            </div>
            <div class="backup-actions">
              <button class="secondary-button" :disabled="!ready" @click="exportBackup">
                <Download :size="16" /> 导出备份</button
              ><button class="secondary-button" :disabled="!ready" @click="fileInput?.click()">
                <Upload :size="16" /> 导入备份
              </button>
            </div>
            <input
              ref="fileInput"
              type="file"
              accept=".json,application/json"
              aria-label="选择学习记录备份文件"
              hidden
              @change="chooseImport"
            />
          </section>
          <section class="panel app-info-panel" aria-labelledby="app-info-title">
            <div class="app-info-title">
              <span class="stat-icon"><Info :size="22" /></span>
              <div>
                <h2 id="app-info-title">应用信息</h2>
                <p>用于确认当前版本和离线内容是否准备完成。</p>
              </div>
            </div>
            <dl class="app-info-list">
              <div>
                <dt>当前版本</dt>
                <dd>{{ version }}</dd>
              </div>
              <div>
                <dt>网络状态</dt>
                <dd>{{ connectivity.network }}</dd>
              </div>
              <div>
                <dt>离线内容</dt>
                <dd>{{ connectivity.cache }}</dd>
              </div>
            </dl>
          </section>
        </template>

        <template v-else-if="route === '/search'">
          <div class="page-heading">
            <div class="eyebrow">需要的时候，找得到</div>
            <h1 tabindex="-1">搜索<span class="accent-period">。</span></h1>
            <p>从一个关键字，回到一个知识点。</p>
          </div>
          <div class="filter-tabs" aria-label="搜索范围">
            <button
              :class="{ selected: searchScope === 'article' }"
              :aria-pressed="searchScope === 'article'"
              @click="searchScope = 'article'"
            >
              笔记{{ query.trim() ? ` ${foundArticles.length}` : '' }}</button
            ><button
              :class="{ selected: searchScope === 'question' }"
              :aria-pressed="searchScope === 'question'"
              @click="searchScope = 'question'"
            >
              面试题{{ query.trim() ? ` ${foundQuestions.length}` : '' }}
            </button>
            <button
              :class="{ selected: searchScope === 'case' }"
              :aria-pressed="searchScope === 'case'"
              @click="searchScope = 'case'"
            >
              案例{{ query.trim() ? ` ${foundCases.length}` : '' }}
            </button>
          </div>
          <NoteFilters v-if="searchScope === 'article'" v-model="searchFilters" />
          <div class="search-box panel">
            <Search :size="22" /><input
              id="site-search"
              v-model="query"
              type="search"
              :aria-label="
                searchScope === 'article'
                  ? '搜索笔记'
                  : searchScope === 'question'
                    ? '搜索面试题'
                    : '搜索案例'
              "
              :placeholder="
                searchScope === 'article'
                  ? '搜索笔记正文、标题或标签…'
                  : searchScope === 'question'
                    ? '搜索面试题、答案或标签…'
                    : '搜索案例标题、问题或本机草稿…'
              "
              autocomplete="off"
            /><button v-if="query" class="icon-button" aria-label="清空搜索" @click="query = ''">
              <X :size="18" />
            </button>
          </div>
          <div v-if="!query.trim()" class="search-suggestions">
            <span class="muted small">试试这些关键字</span
            ><button
              v-for="suggestion in ['引用类型', 'C#', 'GC', '协程']"
              :key="suggestion"
              @click="query = suggestion"
            >
              {{ suggestion }} <ArrowUpRight :size="13" />
            </button>
          </div>
          <template v-else
            ><p class="search-result-count">
              找到
              <strong>{{
                searchScope === 'article'
                  ? foundArticles.length
                  : searchScope === 'question'
                    ? foundQuestions.length
                    : foundCases.length
              }}</strong>
              条相关{{
                searchScope === 'article' ? '笔记' : searchScope === 'question' ? '面试题' : '案例'
              }}
            </p>
            <section v-if="searchScope === 'article' && foundArticles.length">
              <div class="section-heading">
                <h2><BookOpen :size="18" /> 笔记</h2>
              </div>
              <a
                v-for="article in foundArticles"
                :key="article.id"
                :href="`#/article/${article.id}`"
                class="panel search-article"
                ><span class="search-type-icon"><BookOpen :size="20" /></span>
                <div>
                  <h3>{{ article.title }}</h3>
                  <p>{{ article.summary }}</p>
                </div>
                <ArrowUpRight :size="18"
              /></a>
            </section>
            <section
              v-if="searchScope === 'question' && foundQuestions.length"
              class="search-questions"
            >
              <div class="section-heading">
                <h2><Layers :size="18" /> 面试题</h2>
              </div>
              <div class="panel question-list">
                <QuestionRow
                  v-for="question in foundQuestions"
                  :key="question.id"
                  :question="question"
                  :record="records[question.id]"
                  :number="questions.indexOf(question) + 1"
                  @favorite="favorite($event, 'question')"
                />
              </div>
            </section>
            <section v-if="searchScope === 'case' && foundCases.length">
              <div class="section-heading">
                <h2><Flag :size="18" /> 经验案例</h2>
              </div>
              <div class="panel case-search-list">
                <a
                  v-for="item in foundCases"
                  :key="item.id"
                  :href="`#/plan/cases/${item.id}`"
                  class="search-case"
                >
                  <span
                    ><strong>{{ item.title }}</strong
                    ><small>{{ item.description }}</small></span
                  >
                  <ChevronRight :size="17" />
                </a>
              </div>
            </section>
            <div
              v-if="
                searchScope === 'article'
                  ? !foundArticles.length
                  : searchScope === 'question'
                    ? !foundQuestions.length
                    : !foundCases.length
              "
              class="panel empty-state"
            >
              <Search :size="32" />
              <h2>还没有找到相关内容</h2>
              <p>换一个简短关键字，或试试标签名称。</p>
              <button class="secondary-button" @click="clearSearch">清除搜索与筛选</button>
            </div></template
          >
        </template>

        <section v-if="!validPage" class="panel empty-state">
          <BookOpen :size="32" />
          <h1 tabindex="-1">这页内容暂时找不到</h1>
          <p>可以返回笔记库，继续查找其他内容。</p>
          <a href="#/" class="primary-button">返回笔记库 <ArrowRight :size="16" /></a>
        </section>
        <footer class="page-footer">
          <span>BetterSelf<span class="brand-period">.</span></span
          ><span>记录、理解、回顾，然后更进一步。</span>
        </footer>
      </main>
    </div>
    <nav v-if="!isDetail" class="bottom-nav" aria-label="手机主要导航">
      <a
        v-for="item in nav"
        :key="item.path"
        :href="`#${item.path}`"
        @click.prevent="switchTab(item.path)"
        :class="{ active: activePath === item.path }"
        :aria-current="activePath === item.path ? 'page' : undefined"
        ><component :is="item.icon" :size="21" /><span>{{ item.title }}</span
        ><i v-if="item.path === '/practice' && activeReviewCount" class="mobile-nav-dot"></i
      ></a>
    </nav>
  </div>
  <div v-if="toast" class="toast" role="status"><CircleCheck :size="17" /> {{ toast }}</div>
  <dialog
    ref="importDialog"
    class="app-dialog"
    aria-labelledby="import-title"
    @cancel="importPreview = null"
  >
    <div class="dialog-icon"><Upload :size="25" /></div>
    <h2 id="import-title">导入学习记录</h2>
    <p>
      这份备份包含
      {{ importPreview?.records.length || 0 }} 条学习记录与
      {{ importPreview?.planRecords.length || 0 }}
      条计划／案例记录。按修改时间合并，保留每条记录较新的版本。旧版备份不影响已有计划记录。
    </p>
    <div class="dialog-actions">
      <button class="secondary-button" :disabled="importing" @click="cancelImport">取消</button
      ><button class="primary-button" :disabled="importing" @click="confirmImport">
        {{ importing ? '正在合并…' : '合并记录' }}
      </button>
    </div>
  </dialog>
  <dialog ref="installDialog" class="app-dialog" aria-labelledby="install-title">
    <div class="dialog-icon"><Download :size="25" /></div>
    <h2 id="install-title">把 BetterSelf 放到桌面</h2>
    <p>在浏览器菜单中查看“安装应用”或“添加到桌面”。不同浏览器的入口可能有所不同。</p>
    <p>离线内容准备完成后，可以在没有网络时继续阅读和练习。</p>
    <div class="dialog-actions">
      <button class="primary-button" @click="installDialog?.close()">知道了</button>
    </div>
  </dialog>
</template>
