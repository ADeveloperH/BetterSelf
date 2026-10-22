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
} from '@lucide/vue'
import ArticleCard from './components/ArticleCard.vue'
import QuestionRow from './components/QuestionRow.vue'
import Sources from './components/Sources.vue'
import { articles, questions, matchesSearch } from './lib/content'
import { createLearningStore, parseBackup } from './lib/storage'
import { usePwa } from './lib/pwa'
import type { Backup, ContentKind, LearningRecord, Mastery } from './types'

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
const selectedTag = ref('全部')
const practiceFilter = ref('all')
const reviewFilter = ref('weak')
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
  { path: '/', title: '知识库', icon: BookOpen },
  { path: '/practice', title: '面试练习', icon: Layers },
  { path: '/review', title: '我的复习', icon: BrainCircuit },
  { path: '/search', title: '搜索', icon: Search },
]
const currentArticle = computed(() =>
  route.value.startsWith('/article/')
    ? articles.find((item) => item.id === route.value.slice(9))
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
const pageTitle = computed(
  () => nav.find((item) => item.path === activePath.value)?.title || '页面未找到',
)
const masteryLabels: Record<Mastery, string> = {
  unknown: '不会',
  uncertain: '模糊',
  mastered: '掌握',
}
const masteredCount = computed(
  () => questions.filter((item) => records.value[item.id]?.mastery === 'mastered').length,
)
const ratedCount = computed(
  () => questions.filter((item) => records.value[item.id]?.mastery).length,
)
const weakQuestions = computed(() =>
  questions.filter((item) =>
    ['unknown', 'uncertain'].includes(records.value[item.id]?.mastery || ''),
  ),
)
const favoriteCount = computed(
  () => [...articles, ...questions].filter((item) => records.value[item.id]?.favorite).length,
)
const tags = computed(() => ['全部', ...new Set(articles.flatMap((article) => article.tags))])
const visibleArticles = computed(() =>
  articles.filter((item) => selectedTag.value === '全部' || item.tags.includes(selectedTag.value)),
)
const visibleQuestions = computed(() =>
  questions.filter(
    (item) =>
      practiceFilter.value === 'all' ||
      (practiceFilter.value === 'unrated'
        ? !records.value[item.id]?.mastery
        : records.value[item.id]?.mastery === practiceFilter.value),
  ),
)
const reviewQuestions = computed(() =>
  reviewFilter.value === 'weak'
    ? weakQuestions.value
    : reviewFilter.value === 'favorites'
      ? questions.filter((item) => records.value[item.id]?.favorite)
      : questions,
)
const favoriteArticles = computed(() => articles.filter((item) => records.value[item.id]?.favorite))
const foundArticles = computed(() =>
  articles.filter((item) => matchesSearch(item.searchText, query.value)),
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
    ['/', '/practice', '/review', '/search'].includes(route.value) ||
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
  patch: Partial<Pick<LearningRecord, 'mastery' | 'favorite' | 'progress' | 'lastViewedAt'>>,
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
    location.hash = '/search'
    document.querySelector<HTMLInputElement>('#site-search')?.focus()
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
          ><span v-if="item.path === '/review' && weakQuestions.length" class="nav-count">{{
            weakQuestions.length
          }}</span></a
        >
      </nav>
      <div class="sidebar-separator"></div>
      <div class="sidebar-label">正在积累</div>
      <a href="#/practice" class="sidebar-topic"
        ><span class="topic-dot"></span><span>C# 与 Unity 基础</span
        ><span class="sidebar-topic-count">{{ questions.length }}</span></a
      >
      <div class="sidebar-bottom">
        <div class="sidebar-note">
          <div class="note-icon"><Sparkles :size="18" /></div>
          <h3>每一小步，都算数。</h3>
          <p>留下经验，常常回顾。<br />把学过的，变成自己的。</p>
        </div>
        <a href="#/review" class="local-data-link"
          ><HardDrive :size="14" /> 学习记录与备份 <ChevronRight :size="13" /></a
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
          <button class="header-search" @click="location.hash = '/search'">
            <Search :size="16" /><span>搜索知识、问题…</span><kbd>⌘ K</kbd></button
          ><span class="online-badge" :class="{ offline: !online }"
            ><WifiOff v-if="!online" :size="13" /><span v-else class="status-dot"></span
            >{{ cacheLabel }}</span
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
          <section class="welcome-section">
            <div class="welcome-copy">
              <div class="eyebrow"><span></span> 学习，是给未来的自己留一份答案</div>
              <h1 tabindex="-1">今天，积累一点<span class="accent-period">。</span></h1>
              <p>梳理知识，沉淀经验。让每一次复习，都有新的收获。</p>
              <div class="welcome-stats">
                <span
                  ><strong>{{ articles.length }}</strong> 篇知识笔记</span
                ><i></i
                ><span
                  ><strong>{{ questions.length }}</strong> 道面试题</span
                ><i></i
                ><span
                  ><strong>{{ masteredCount }}</strong> 道已掌握</span
                >
              </div>
            </div>
            <a :href="`#/practice/${nextQuestion.id}`" class="focus-card"
              ><div class="focus-top">
                <span><Sparkles :size="14" /> 本次聚焦</span><ArrowUpRight :size="18" />
              </div>
              <div class="focus-title">C# 与 Unity<br />面试基础</div>
              <div class="focus-bottom">
                <span>{{ questions.length }} 道题，从理解到表达</span
                ><span class="focus-arrow"><ArrowRight :size="16" /></span>
              </div>
              <div class="focus-orbit" aria-hidden="true"></div
            ></a>
          </section>

          <div class="dashboard-grid">
            <div class="dashboard-main">
              <section>
                <div class="section-heading">
                  <h2>
                    <BookOpen :size="19" /> 知识笔记
                    <span class="section-count">{{ articles.length }}</span>
                  </h2>
                  <span class="muted small">慢慢整理，持续更新</span>
                </div>
                <div class="filter-tabs" aria-label="按标签筛选文章">
                  <button
                    v-for="tag in tags"
                    :key="tag"
                    :class="{ selected: selectedTag === tag }"
                    :aria-pressed="selectedTag === tag"
                    @click="selectedTag = tag"
                  >
                    {{ tag === '全部' ? '全部内容' : tag }}
                  </button>
                </div>
                <ArticleCard
                  v-for="article in visibleArticles"
                  :key="article.id"
                  :article="article"
                  :record="records[article.id]"
                  @favorite="favorite($event, 'article')"
                />
              </section>
              <section class="warmup-section">
                <div class="section-heading">
                  <h2><Layers :size="19" /> 面试热身</h2>
                  <a href="#/practice" class="subtle-link">查看全部 <ArrowRight :size="14" /></a>
                </div>
                <div class="panel question-list">
                  <QuestionRow
                    v-for="(question, index) in questions.slice(0, 3)"
                    :key="question.id"
                    :question="question"
                    :record="records[question.id]"
                    :number="index + 1"
                    @favorite="favorite($event, 'question')"
                  />
                </div>
              </section>
            </div>
            <aside class="dashboard-aside">
              <section class="panel progress-panel">
                <div class="section-heading">
                  <h2>学习概览</h2>
                  <BrainCircuit :size="18" class="muted" />
                </div>
                <div
                  class="progress-ring"
                  :style="{ '--progress': `${(masteredCount / questions.length) * 100}%` }"
                >
                  <div>
                    <strong
                      >{{ masteredCount }}<span>/{{ questions.length }}</span></strong
                    ><small>已掌握</small>
                  </div>
                </div>
                <div class="progress-legend">
                  <span
                    ><i class="legend-purple"></i>已掌握<strong>{{ masteredCount }}</strong></span
                  ><span
                    ><i class="legend-amber"></i>待巩固<strong>{{
                      weakQuestions.length
                    }}</strong></span
                  ><span
                    ><i class="legend-gray"></i>未自评<strong>{{
                      questions.length - ratedCount
                    }}</strong></span
                  >
                </div>
                <a :href="`#/practice/${nextQuestion.id}`" class="primary-button wide"
                  ><BrainCircuit :size="16" /> {{ ratedCount ? '继续练习' : '开始一次练习' }}
                  <ArrowRight :size="15"
                /></a>
              </section>
              <section class="panel recent-panel">
                <div class="section-heading">
                  <h2>最近阅读</h2>
                  <Clock3 :size="16" class="muted" />
                </div>
                <template v-if="recentArticle"
                  ><a :href="`#/article/${recentArticle.id}`" class="recent-title">{{
                    recentArticle.title
                  }}</a>
                  <div class="reading-track">
                    <span
                      :style="{ width: `${(records[recentArticle.id]?.progress || 0) * 100}%` }"
                    ></span>
                  </div>
                  <span class="muted small"
                    >已读 {{ Math.round((records[recentArticle.id]?.progress || 0) * 100) }}%</span
                  ></template
                ><template v-else
                  ><div class="recent-empty-icon"><BookOpen :size="24" /></div>
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
            <a href="#/" class="subtle-link"><ArrowLeft :size="16" /> 返回知识库</a
            ><span class="muted small">已读 {{ Math.round(readProgress * 100) }}%</span>
          </div>
          <div class="detail-layout">
            <article class="panel article-detail">
              <div class="detail-heading">
                <div class="card-eyebrow">
                  {{ currentArticle.topic }}
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
              <section class="related-section">
                <h2>把理解变成表达</h2>
                <p>用关联面试题，检查自己是否真正讲清楚了。</p>
                <a
                  :href="`#/practice/${questions.find((question) => question.articleIds.includes(currentArticle!.id))?.id}`"
                  class="primary-button"
                  >练习关联题目 <ArrowRight :size="16"
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
            <div class="eyebrow">让学过的，留下来</div>
            <h1 tabindex="-1">我的复习<span class="accent-period">。</span></h1>
            <p>回到还不熟悉的地方，一次解决一个问题。</p>
          </div>
          <div class="review-stats">
            <div class="panel">
              <span class="stat-icon purple"><CircleCheck :size="21" /></span>
              <div>
                <strong>{{ masteredCount }}</strong
                ><span>已掌握</span>
              </div>
            </div>
            <div class="panel">
              <span class="stat-icon amber"><RefreshCw :size="21" /></span>
              <div>
                <strong>{{ weakQuestions.length }}</strong
                ><span>待巩固</span>
              </div>
            </div>
            <div class="panel">
              <span class="stat-icon blue"><Bookmark :size="21" /></span>
              <div>
                <strong>{{ favoriteCount }}</strong
                ><span>已收藏</span>
              </div>
            </div>
          </div>
          <div class="filter-tabs">
            <button
              v-for="filter in [
                { id: 'weak', label: '待巩固' },
                { id: 'favorites', label: '已收藏' },
                { id: 'all', label: '全部题目' },
              ]"
              :key="filter.id"
              :class="{ selected: reviewFilter === filter.id }"
              :aria-pressed="reviewFilter === filter.id"
              @click="reviewFilter = filter.id"
            >
              {{ filter.label }}
            </button>
          </div>
          <div v-if="reviewQuestions.length" class="panel question-list">
            <QuestionRow
              v-for="question in reviewQuestions"
              :key="question.id"
              :question="question"
              :record="records[question.id]"
              :number="questions.indexOf(question) + 1"
              @favorite="favorite($event, 'question')"
            />
          </div>
          <div
            v-else-if="reviewFilter !== 'favorites' || !favoriteArticles.length"
            class="panel empty-state"
          >
            <BrainCircuit :size="32" />
            <h2>
              {{ reviewFilter === 'favorites' ? '收藏值得再看的内容' : '从一次真实的自评开始' }}
            </h2>
            <p>
              {{
                reviewFilter === 'favorites'
                  ? '点击文章或题目旁的书签，就能在这里找到它。'
                  : '标记为“不会”或“模糊”的题目，会集中出现在这里。'
              }}
            </p>
            <a href="#/practice" class="primary-button">去练习几道题 <ArrowRight :size="16" /></a>
          </div>
          <div
            v-if="reviewFilter === 'favorites' && favoriteArticles.length"
            class="favorite-articles"
          >
            <h2>收藏的笔记</h2>
            <a
              v-for="article in favoriteArticles"
              :key="article.id"
              :href="`#/article/${article.id}`"
              class="panel favorite-article-link"
              ><BookOpen :size="21" /><span>{{ article.title }}</span
              ><ChevronRight :size="18"
            /></a>
          </div>
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
            <h1 tabindex="-1">搜索知识<span class="accent-period">。</span></h1>
            <p>从一个关键字，回到一个知识点。</p>
          </div>
          <div class="search-box panel">
            <Search :size="22" /><input
              id="site-search"
              v-model="query"
              type="search"
              aria-label="搜索知识和面试题"
              placeholder="搜索知识、面试题或标签…"
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
              找到 <strong>{{ foundArticles.length + foundQuestions.length }}</strong> 条相关内容
            </p>
            <section v-if="foundArticles.length">
              <div class="section-heading">
                <h2><BookOpen :size="18" /> 知识笔记</h2>
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
            <section v-if="foundQuestions.length" class="search-questions">
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
            <div v-if="!foundArticles.length && !foundQuestions.length" class="panel empty-state">
              <Search :size="32" />
              <h2>还没有找到相关内容</h2>
              <p>换一个简短关键字，或试试标签名称。</p>
              <button class="secondary-button" @click="query = ''">重新搜索</button>
            </div></template
          >
        </template>

        <section v-if="!validPage" class="panel empty-state">
          <BookOpen :size="32" />
          <h1 tabindex="-1">这页内容暂时找不到</h1>
          <p>可以返回知识库，继续查找其他内容。</p>
          <a href="#/" class="primary-button">返回知识库 <ArrowRight :size="16" /></a>
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
        ><i v-if="item.path === '/review' && weakQuestions.length" class="mobile-nav-dot"></i
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
