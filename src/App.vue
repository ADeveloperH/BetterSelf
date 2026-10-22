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
  SlidersHorizontal,
  ArrowLeft,
  List,
  HardDrive,
  ExternalLink,
  Settings,
} from '@lucide/vue'
import ArticleCard from './components/ArticleCard.vue'
import NoteFilters from './components/NoteFilters.vue'
import QuestionRow from './components/QuestionRow.vue'
import Sources from './components/Sources.vue'
import { articles, questions, domains, matchesSearch } from './lib/content'
import { emptyNoteFilters, matchesNoteFilters, noteLocation, noteTypeLabels } from './lib/notes'
import { createLearningStore, parseBackup } from './lib/storage'
import { usePwa } from './lib/pwa'
import type { Backup, ContentKind, LearningRecord, Mastery, ReviewState } from './types'

const document = window.document
const location = window.location
const baseUrl = import.meta.env.BASE_URL
const readRoute = () => {
  try {
    return decodeURIComponent(location.hash.slice(1) || '/')
  } catch {
    return '/not-found'
  }
}
const route = ref(readRoute())
const records = ref<Record<string, LearningRecord>>({})
const ready = ref(false)
const storageError = ref('')
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout>
const query = ref('')
const noteFilters = ref(emptyNoteFilters())
const searchFilters = ref(emptyNoteFilters())
const noteView = ref('all')
const searchScope = ref<'article' | 'question'>('article')
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
  { path: '/', title: '笔记库', icon: BookOpen },
  { path: '/practice', title: '面试练习', icon: Layers },
  { path: '/review', title: '我的复习', icon: BrainCircuit },
  { path: '/search', title: '搜索', icon: Search },
]
const currentArticle = computed(() =>
  route.value.startsWith('/article/')
    ? articles.find((item) => item.id === route.value.slice(9))
    : undefined,
)
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
const activePath = computed(() =>
  route.value.startsWith('/article/')
    ? '/'
    : route.value.startsWith('/practice')
      ? '/practice'
      : route.value,
)
const pageTitle = computed(() =>
  route.value === '/settings'
    ? '设置与备份'
    : nav.find((item) => item.path === activePath.value)?.title || '页面未找到',
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
function selectNoteDomain(domain = '') {
  noteFilters.value = { ...emptyNoteFilters(), domain }
  noteView.value = 'all'
}
function clearSearch() {
  query.value = ''
  searchFilters.value = emptyNoteFilters()
}
const visibleArticles = computed(() =>
  articles.filter(
    (item) =>
      matchesNoteFilters(item, noteFilters.value) &&
      (noteView.value !== 'favorites' || records.value[item.id]?.favorite),
  ),
)
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
const favoriteArticles = computed(() => articles.filter((item) => records.value[item.id]?.favorite))
const foundArticles = computed(() =>
  articles.filter(
    (item) =>
      matchesSearch(item.searchText, query.value) && matchesNoteFilters(item, searchFilters.value),
  ),
)
const foundQuestions = computed(() =>
  questions.filter((item) => matchesSearch(item.searchText, query.value)),
)
const recentArticle = computed(
  () =>
    [...articles]
      .filter((item) => records.value[item.id]?.lastViewedAt)
      .sort((a, b) =>
        (records.value[b.id]?.lastViewedAt || '').localeCompare(
          records.value[a.id]?.lastViewedAt || '',
        ),
      )[0],
)
const nextQuestion = computed(
  () => questions.find((item) => records.value[item.id]?.mastery !== 'mastered') || questions[0],
)
const questionIndex = computed(() =>
  questions.findIndex((item) => item.id === currentQuestion.value?.id),
)
const cacheLabel = computed(() =>
  !online.value
    ? '当前离线'
    : isDev
      ? '本地预览'
      : registrationError.value
        ? '浏览器阅读'
        : offlineReady.value
          ? '离线已就绪'
          : '准备离线使用',
)
const validPage = computed(
  () =>
    ['/', '/practice', '/review', '/search', '/settings'].includes(route.value) ||
    !!currentArticle.value ||
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
  if (route.value !== '/search')
    searchScope.value = activePath.value === '/practice' ? 'question' : 'article'
  location.hash = '/search'
  void nextTick(() => document.querySelector<HTMLInputElement>('#site-search')?.focus())
}

let scrollTimer: ReturnType<typeof setTimeout> | undefined
let activation = 0
function saveReading() {
  clearTimeout(scrollTimer)
  const article = currentArticle.value
  if (article && ready.value && !restoring.value)
    return save(article.id, 'article', { progress: readProgress.value })
}
function onScroll() {
  if (!currentArticle.value || !ready.value || restoring.value) return
  const max = document.documentElement.scrollHeight - innerHeight
  readProgress.value = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 1
  clearTimeout(scrollTimer)
  scrollTimer = setTimeout(() => {
    void saveReading()
  }, 250)
}
async function activateRoute() {
  const token = ++activation
  revealed.value = false
  const article = currentArticle.value
  const savedProgress = article ? records.value[article.id]?.progress || 0 : 0
  restoring.value = true
  await nextTick()
  if (token !== activation) return
  window.scrollTo(
    0,
    article ? savedProgress * Math.max(0, document.documentElement.scrollHeight - innerHeight) : 0,
  )
  readProgress.value = savedProgress
  document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true })
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      if (token === activation) restoring.value = false
    }),
  )
  if (article && ready.value)
    await save(article.id, 'article', { lastViewedAt: new Date().toISOString() })
  if (route.value === '/search')
    await nextTick(() => document.querySelector<HTMLInputElement>('#site-search')?.focus())
}
function onHashChange() {
  void saveReading()
  if (readRoute() === '/review' && route.value !== '/review') {
    reviewFilter.value = 'active'
    if (activePath.value === '/practice') reviewKind.value = 'question'
    else if (activePath.value === '/') reviewKind.value = 'article'
  }
  if (readRoute() === '/search' && route.value !== '/search') {
    searchScope.value = activePath.value === '/practice' ? 'question' : 'article'
  }
  route.value = readRoute()
}
function onVisibilityChange() {
  if (document.visibilityState === 'hidden') void saveReading()
}
watch(route, () => {
  void activateRoute()
})
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
      results.some((result) => result.status === 'rejected')
    ) {
      notify('有学习记录尚未保存，请先处理页面上方的提示。')
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
    const count = await store.import(importPreview.value)
    records.value = Object.fromEntries((await store.all()).map((record) => [record.id, record]))
    importDialog.value?.close()
    importPreview.value = null
    notify(`已合并 ${count} 条较新的学习记录。`)
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
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('pagehide', saveReading)
  window.addEventListener('keydown', keyboardShortcut)
  document.addEventListener('visibilitychange', onVisibilityChange)
  try {
    records.value = Object.fromEntries((await store.all()).map((record) => [record.id, record]))
    ready.value = true
  } catch {
    storageError.value = '当前浏览器无法保存学习记录。文章仍可阅读，请允许网站存储后重新打开。'
  }
  await activateRoute()
})
onUnmounted(() => {
  window.removeEventListener('hashchange', onHashChange)
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('pagehide', saveReading)
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
  <div class="app-shell">
    <aside class="sidebar">
      <a href="#/" class="brand"
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
          :class="{ active: activePath === item.path }"
          :aria-current="activePath === item.path ? 'page' : undefined"
          ><component :is="item.icon" :size="19" /><span>{{ item.title }}</span
          ><span v-if="item.path === '/review' && activeReviewCount" class="nav-count">{{
            activeReviewCount
          }}</span></a
        >
      </nav>
      <div class="sidebar-separator"></div>
      <div class="sidebar-label">笔记主题</div>
      <a
        v-for="domain in populatedDomains"
        :key="domain.id"
        href="#/"
        class="sidebar-topic"
        @click="selectNoteDomain(domain.id)"
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
      <header class="topbar">
        <div class="desktop-breadcrumb">
          我的学习空间 <ChevronRight :size="13" /><span>{{ pageTitle }}</span>
        </div>
        <a href="#/" class="mobile-brand"
          ><img :src="`${baseUrl}favicon.svg`" alt="" width="28" height="28" />BetterSelf<span
            >.</span
          ></a
        >
        <div class="topbar-actions">
          <button class="header-search" @click="openSearch">
            <Search :size="16" /><span>搜索笔记、面试题…</span><kbd>⌘ K</kbd></button
          ><span class="online-badge" :class="{ offline: !online }"
            ><WifiOff v-if="!online" :size="13" /><span v-else class="status-dot"></span
            >{{ cacheLabel }}</span
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

      <main id="main-content" class="main-content" tabindex="-1">
        <template v-if="route === '/'">
          <div class="page-heading library-heading">
            <div class="eyebrow">记录经验，需要时找得到</div>
            <h1 tabindex="-1">笔记库<span class="accent-period">。</span></h1>
            <p>按主题查阅、收藏和积累，让知识各有位置。</p>
            <button class="secondary-button" @click="openSearch">
              <Search :size="16" /> 搜索笔记
            </button>
          </div>
          <div class="dashboard-grid">
            <section class="dashboard-main">
              <div class="filter-tabs" aria-label="笔记视图">
                <button
                  :class="{ selected: noteView === 'all' }"
                  :aria-pressed="noteView === 'all'"
                  @click="noteView = 'all'"
                >
                  全部笔记 {{ articles.length }}
                </button>
                <button
                  :class="{ selected: noteView === 'favorites' }"
                  :aria-pressed="noteView === 'favorites'"
                  @click="noteView = 'favorites'"
                >
                  我的收藏 {{ favoriteArticles.length }}
                </button>
              </div>
              <NoteFilters v-model="noteFilters" />
              <p class="muted small result-summary" role="status">
                {{ visibleArticles.length }} 篇笔记
              </p>
              <ArticleCard
                v-for="article in visibleArticles"
                :key="article.id"
                :article="article"
                :record="records[article.id]"
                @favorite="favorite($event, 'article')"
              />
              <div v-if="!visibleArticles.length" class="panel empty-state">
                <BookOpen :size="30" />
                <h2>
                  {{ noteView === 'favorites' ? '这个范围还没有收藏' : '没有符合筛选条件的笔记' }}
                </h2>
                <p>可以清除筛选，或返回全部笔记继续查阅。</p>
                <button class="secondary-button" @click="selectNoteDomain()">查看全部笔记</button>
              </div>
            </section>
            <aside class="dashboard-aside">
              <section class="panel recent-panel">
                <div class="section-heading">
                  <h2>最近阅读</h2>
                  <Clock3 :size="16" class="muted" />
                </div>
                <template v-if="recentArticle">
                  <a :href="`#/article/${recentArticle.id}`" class="recent-title">{{
                    recentArticle.title
                  }}</a>
                  <div class="reading-track">
                    <span
                      :style="{ width: `${(records[recentArticle.id]?.progress || 0) * 100}%` }"
                    ></span>
                  </div>
                  <span class="muted small"
                    >已读 {{ Math.round((records[recentArticle.id]?.progress || 0) * 100) }}%</span
                  >
                </template>
                <template v-else
                  ><BookOpen :size="24" />
                  <p>从一篇笔记开始</p>
                  <span class="muted small">阅读后，在这里接着看。</span></template
                >
              </section>
              <button v-if="!installed" class="install-card" @click="requestInstall">
                <span class="install-icon"><Download :size="19" /></span
                ><span><strong>把学习放到桌面</strong><small>随手打开，随时积累</small></span
                ><ChevronRight :size="17" />
              </button>
            </aside>
          </div>
        </template>

        <template v-else-if="currentArticle">
          <div class="detail-topline">
            <a href="#/" class="subtle-link"><ArrowLeft :size="16" /> 返回笔记库</a
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
            <a href="#/practice" class="subtle-link"><ArrowLeft :size="16" /> 返回题目列表</a
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

        <template v-else-if="route === '/settings'">
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
                <p>学习记录保存在这台设备。导出备份，可以带到另一台设备继续使用。</p>
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
          </div>
          <NoteFilters v-if="searchScope === 'article'" v-model="searchFilters" />
          <div class="search-box panel">
            <Search :size="22" /><input
              id="site-search"
              v-model="query"
              type="search"
              :aria-label="searchScope === 'article' ? '搜索笔记' : '搜索面试题'"
              :placeholder="
                searchScope === 'article' ? '搜索笔记正文、标题或标签…' : '搜索面试题、答案或标签…'
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
                searchScope === 'article' ? foundArticles.length : foundQuestions.length
              }}</strong>
              条相关{{ searchScope === 'article' ? '笔记' : '面试题' }}
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
            <div
              v-if="searchScope === 'article' ? !foundArticles.length : !foundQuestions.length"
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
    <nav class="bottom-nav" aria-label="手机主要导航">
      <a
        v-for="item in nav"
        :key="item.path"
        :href="`#${item.path}`"
        :class="{ active: activePath === item.path }"
        :aria-current="activePath === item.path ? 'page' : undefined"
        ><component :is="item.icon" :size="21" /><span>{{ item.title }}</span
        ><i v-if="item.path === '/review' && activeReviewCount" class="mobile-nav-dot"></i
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
      {{ importPreview?.records.length || 0 }} 条记录。按修改时间合并，保留每条记录较新的版本。
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
