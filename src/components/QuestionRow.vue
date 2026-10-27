<script setup lang="ts">
import { ChevronRight, Bookmark } from '@lucide/vue'
import type { LearningRecord, Question } from '../types'
defineProps<{ question: Question; record?: LearningRecord; number: number }>()
defineEmits<{ favorite: [id: string] }>()
const labels = { unknown: '不会', uncertain: '模糊', mastered: '掌握' }
</script>

<template>
  <div class="question-row">
    <span class="question-number">{{ String(number).padStart(2, '0') }}</span>
    <a :href="`#/practice/${question.id}`" class="question-row-main"
      ><h3>{{ question.title }}</h3>
      <div class="question-row-meta">
        <span>{{ question.level }}</span
        ><span class="dot">·</span><span>{{ question.tags.join(' / ') }}</span
        ><span v-if="record?.mastery" class="status-badge" :class="record.mastery">{{
          labels[record.mastery]
        }}</span>
      </div></a
    >
    <button
      class="icon-button row-bookmark"
      :class="{ bookmarked: record?.favorite }"
      :aria-label="record?.favorite ? `取消收藏：${question.title}` : `收藏：${question.title}`"
      :aria-pressed="!!record?.favorite"
      @click="$emit('favorite', question.id)"
    >
      <Bookmark :size="17" :fill="record?.favorite ? 'currentColor' : 'none'" />
    </button>
    <a
      :href="`#/practice/${question.id}`"
      class="icon-button row-arrow"
      :aria-label="`练习：${question.title}`"
      ><ChevronRight :size="18"
    /></a>
  </div>
</template>
