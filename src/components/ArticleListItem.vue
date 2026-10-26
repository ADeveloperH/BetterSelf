<script setup lang="ts">
import { Bookmark, ChevronRight, Clock3 } from '@lucide/vue'
import { domains } from '../lib/content'
import { noteDisplayTitle, noteLocation, noteStatus, noteTypeLabels } from '../lib/notes'
import type { Article, LearningRecord } from '../types'

defineProps<{ article: Article; record?: LearningRecord }>()
defineEmits<{ favorite: [id: string] }>()
</script>

<template>
  <div class="knowledge-row">
    <a :href="`#/article/${article.id}`" class="knowledge-row-main">
      <div class="knowledge-row-heading">
        <h3>{{ noteDisplayTitle(article) }}</h3>
        <span class="note-status" :class="noteStatus(article).id">{{
          noteStatus(article).label
        }}</span>
      </div>
      <p>{{ article.summary }}</p>
      <div class="knowledge-row-meta">
        <span>{{ noteLocation(article, domains) }}</span>
        <span>{{ noteTypeLabels[article.noteType] }}</span>
        <span><Clock3 :size="13" /> {{ article.minutes }} 分钟</span>
      </div>
      <div
        v-if="record?.progress"
        class="reading-track"
        :aria-label="`已读 ${Math.round(record.progress * 100)}%`"
      >
        <span :style="{ width: `${record.progress * 100}%` }"></span>
      </div>
    </a>
    <button
      class="icon-button knowledge-bookmark"
      :class="{ bookmarked: record?.favorite }"
      :aria-label="record?.favorite ? `取消收藏：${article.title}` : `收藏：${article.title}`"
      :aria-pressed="!!record?.favorite"
      @click="$emit('favorite', article.id)"
    >
      <Bookmark :size="17" :fill="record?.favorite ? 'currentColor' : 'none'" />
    </button>
    <a
      :href="`#/article/${article.id}`"
      class="icon-button knowledge-arrow"
      :aria-label="`阅读：${article.title}`"
    >
      <ChevronRight :size="18" />
    </a>
  </div>
</template>
