<script setup lang="ts">
import { computed } from 'vue'
import {
  ArrowRight,
  ArrowLeft,
  Bookmark,
  BookOpen,
  CheckCircle2,
  Clock3,
  FileClock,
  FolderOpen,
  Search,
  SlidersHorizontal,
} from '@lucide/vue'
import ArticleListItem from './ArticleListItem.vue'
import NoteFilters from './NoteFilters.vue'
import { articles, domains } from '../lib/content'
import {
  emptyNoteFilters,
  matchesNoteFilters,
  type NoteFilters as NoteFilterState,
} from '../lib/notes'
import type { LearningRecord } from '../types'

const props = defineProps<{
  route: string
  records: Record<string, LearningRecord>
}>()
const filters = defineModel<NoteFilterState>('filters', { required: true })
defineEmits<{ favorite: [id: string]; search: []; back: [] }>()

const populatedDomains = computed(() =>
  domains.filter((domain) => articles.some((article) => article.domainId === domain.id)),
)
const recentArticle = computed(
  () =>
    [...articles]
      .filter((article) => props.records[article.id]?.lastViewedAt)
      .sort((a, b) =>
        (props.records[b.id]?.lastViewedAt || '').localeCompare(
          props.records[a.id]?.lastViewedAt || '',
        ),
      )[0],
)
const domainId = computed(() => props.route.match(/^\/library\/topic\/([^/]+)$/)?.[1] || '')
const currentDomain = computed(() => domains.find((domain) => domain.id === domainId.value))
const collection = computed(
  () => props.route.match(/^\/library\/(all|favorites|history|unverified|recent)$/)?.[1],
)
const collectionTitle = computed(
  () =>
    ({
      all: '全部笔记',
      favorites: '我的收藏',
      history: '历史资料',
      unverified: '待复核',
      recent: '最近更新',
    })[collection.value || ''] || '',
)
const collectionDescription = computed(
  () =>
    ({
      all: '集中浏览全部内容，需要时再展开筛选。',
      favorites: '保留经常回看的知识和经验。',
      history: '旧版本与历史排查记录，阅读时注意适用范围。',
      unverified: '尚未完成实测或完整复核的内容。',
      recent: '按内容更新时间从近到远排列。',
    })[collection.value || ''] || '',
)
const collectionArticles = computed(() => {
  let result = [...articles]
  if (collection.value === 'favorites')
    result = result.filter((article) => props.records[article.id]?.favorite)
  if (collection.value === 'history')
    result = result.filter(
      (article) => article.title.includes('（历史）') || article.applicability.includes('历史'),
    )
  if (collection.value === 'unverified')
    result = result.filter((article) => !article.verifiedAt && !article.sample)
  result = result.filter((article) => matchesNoteFilters(article, filters.value))
  if (collection.value === 'recent') result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return result
})
const topicArticles = computed(() =>
  articles.filter((article) => article.domainId === domainId.value),
)
const latestArticles = computed(() =>
  [...articles].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3),
)
const favoritesCount = computed(
  () => articles.filter((article) => props.records[article.id]?.favorite).length,
)
const historyCount = computed(
  () =>
    articles.filter(
      (article) => article.title.includes('（历史）') || article.applicability.includes('历史'),
    ).length,
)
const unverifiedCount = computed(
  () => articles.filter((article) => !article.verifiedAt && !article.sample).length,
)
function resetFilters() {
  filters.value = emptyNoteFilters()
}
</script>

<template>
  <template v-if="route === '/'">
    <div class="page-heading library-heading">
      <div class="eyebrow">整理后的知识，各有位置</div>
      <h1 tabindex="-1">知识库<span class="accent-period">。</span></h1>
      <p>先按主题进入，需要时再查看集合与全部内容。</p>
      <button class="secondary-button" @click="$emit('search')">
        <Search :size="16" /> 搜索知识
      </button>
    </div>

    <a v-if="recentArticle" :href="`#/article/${recentArticle.id}`" class="continue-reading panel">
      <span class="continue-icon"><BookOpen :size="20" /></span>
      <span>
        <small>继续阅读</small>
        <strong>{{ recentArticle.title }}</strong>
        <span>已读 {{ Math.round((records[recentArticle.id]?.progress || 0) * 100) }}%</span>
      </span>
      <ArrowRight :size="18" />
    </a>

    <section class="knowledge-section" aria-labelledby="topic-heading">
      <div class="section-heading">
        <h2 id="topic-heading"><FolderOpen :size="18" /> 知识主题</h2>
        <span class="muted small">{{ populatedDomains.length }} 个主题</span>
      </div>
      <div class="topic-grid">
        <a
          v-for="domain in populatedDomains"
          :key="domain.id"
          :href="`#/library/topic/${domain.id}`"
          class="topic-card"
        >
          <span>{{ domain.title }}</span>
          <strong>{{ articles.filter((article) => article.domainId === domain.id).length }}</strong>
          <small>篇笔记</small>
          <ArrowRight :size="16" />
        </a>
      </div>
    </section>

    <section class="knowledge-section" aria-labelledby="collection-heading">
      <div class="section-heading">
        <h2 id="collection-heading"><Bookmark :size="18" /> 常用集合</h2>
      </div>
      <div class="collection-list panel">
        <a href="#/library/recent"
          ><Clock3 :size="18" /><span>最近更新</span><strong>{{ articles.length }}</strong
          ><ArrowRight :size="16"
        /></a>
        <a href="#/library/favorites"
          ><Bookmark :size="18" /><span>我的收藏</span><strong>{{ favoritesCount }}</strong
          ><ArrowRight :size="16"
        /></a>
        <a href="#/library/unverified"
          ><CheckCircle2 :size="18" /><span>待复核</span><strong>{{ unverifiedCount }}</strong
          ><ArrowRight :size="16"
        /></a>
        <a href="#/library/history"
          ><FileClock :size="18" /><span>历史资料</span><strong>{{ historyCount }}</strong
          ><ArrowRight :size="16"
        /></a>
      </div>
    </section>

    <section class="knowledge-section" aria-labelledby="latest-heading">
      <div class="section-heading">
        <h2 id="latest-heading">最近整理</h2>
        <a href="#/library/all" class="subtle-link">查看全部 <ArrowRight :size="14" /></a>
      </div>
      <div class="knowledge-list panel">
        <ArticleListItem
          v-for="article in latestArticles"
          :key="article.id"
          :article="article"
          :record="records[article.id]"
          @favorite="$emit('favorite', $event)"
        />
      </div>
    </section>
  </template>

  <template v-else-if="currentDomain">
    <div class="detail-topline">
      <button class="subtle-link page-back" @click="$emit('back')">
        <ArrowLeft :size="16" /> 返回知识库
      </button>
    </div>
    <div class="page-heading compact-heading">
      <div class="eyebrow">知识主题</div>
      <h1 tabindex="-1">{{ currentDomain.title }}<span class="accent-period">。</span></h1>
      <p>{{ topicArticles.length }} 篇笔记，按主题内的方向分组。</p>
    </div>
    <section
      v-for="category in currentDomain.categories.filter((item) =>
        topicArticles.some((article) => article.categoryId === item.id),
      )"
      :key="category.id"
      class="knowledge-section topic-group"
    >
      <div class="section-heading">
        <h2>{{ category.title }}</h2>
        <span class="section-count">{{
          topicArticles.filter((article) => article.categoryId === category.id).length
        }}</span>
      </div>
      <div class="knowledge-list panel">
        <ArticleListItem
          v-for="article in topicArticles.filter((item) => item.categoryId === category.id)"
          :key="article.id"
          :article="article"
          :record="records[article.id]"
          @favorite="$emit('favorite', $event)"
        />
      </div>
    </section>
  </template>

  <template v-else-if="collection">
    <div class="detail-topline">
      <button class="subtle-link page-back" @click="$emit('back')">
        <ArrowLeft :size="16" /> 返回知识库
      </button>
    </div>
    <div class="page-heading compact-heading">
      <div class="eyebrow">知识集合</div>
      <h1 tabindex="-1">{{ collectionTitle }}<span class="accent-period">。</span></h1>
      <p>{{ collectionDescription }}</p>
    </div>
    <details class="library-filter-panel panel">
      <summary><SlidersHorizontal :size="17" /> 筛选笔记</summary>
      <NoteFilters v-model="filters" />
    </details>
    <p class="muted small result-summary" role="status">{{ collectionArticles.length }} 篇笔记</p>
    <div v-if="collectionArticles.length" class="knowledge-list panel">
      <ArticleListItem
        v-for="article in collectionArticles"
        :key="article.id"
        :article="article"
        :record="records[article.id]"
        @favorite="$emit('favorite', $event)"
      />
    </div>
    <div v-else class="panel empty-state">
      <BookOpen :size="30" />
      <h2>这个集合暂时没有内容</h2>
      <p>可以清除筛选，或者回到知识库浏览其他主题。</p>
      <button class="secondary-button" @click="resetFilters">清除筛选</button>
    </div>
  </template>
</template>
