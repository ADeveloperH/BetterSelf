<script setup lang="ts">
import { ArrowUpRight, Clock3, FileText, Bookmark, ArrowRight } from '@lucide/vue'
import type { Article, LearningRecord } from '../types'
defineProps<{ article: Article; record?: LearningRecord }>()
defineEmits<{ favorite: [id: string] }>()
</script>

<template>
  <article class="article-card panel">
    <div class="article-card-cover" aria-hidden="true">
      <div class="cover-grid"></div>
      <span class="cover-tag">C# / UNITY</span>
      <div class="code-illustration">
        <span class="code-bracket">{</span
        ><span class="code-word">value<span class="code-dot">.</span></span
        ><span class="code-bracket">}</span>
      </div>
      <span class="cover-caption">理解机制，让经验有迹可循。</span>
      <ArrowUpRight class="cover-arrow" :size="23" />
    </div>
    <div class="article-card-content">
      <div class="card-eyebrow">
        <span class="tiny-square"></span> C# 基础 <span class="dot">·</span>
        <span class="sample-label">示例内容</span>
      </div>
      <a :href="`#/article/${article.id}`" class="article-title-link"
        ><h3>{{ article.title }}</h3></a
      >
      <p class="article-summary">{{ article.summary }}</p>
      <div class="article-card-meta">
        <span><Clock3 :size="14" /> {{ article.minutes }} 分钟阅读</span
        ><span><FileText :size="14" /> {{ article.updatedAt.replaceAll('-', '.') }}</span>
      </div>
      <div
        v-if="record?.progress"
        class="reading-track"
        :aria-label="`已读 ${Math.round(record.progress * 100)}%`"
      >
        <span :style="{ width: `${record.progress * 100}%` }"></span>
      </div>
      <div class="article-card-actions">
        <a :href="`#/article/${article.id}`" class="text-link"
          >{{ record?.progress ? '继续阅读' : '开始阅读' }} <ArrowRight :size="16" /></a
        ><button
          class="icon-button"
          :class="{ bookmarked: record?.favorite }"
          :aria-label="record?.favorite ? '取消收藏文章' : '收藏文章'"
          :aria-pressed="!!record?.favorite"
          @click="$emit('favorite', article.id)"
        >
          <Bookmark :size="18" :fill="record?.favorite ? 'currentColor' : 'none'" />
        </button>
      </div>
    </div>
  </article>
</template>
