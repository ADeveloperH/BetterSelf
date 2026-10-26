<script setup lang="ts">
import { computed } from 'vue'
import { ArrowUpRight, X, RefreshCw } from '@lucide/vue'
import { articles, questions } from '../lib/content'
import { planStatusLabels } from '../lib/plan'
import type { PlanKind, PlanRecord, PlanStatus } from '../types'

const props = defineProps<{
  id: string
  kind: PlanKind
  record?: PlanRecord
  disabled: boolean
  saving: boolean
  error: boolean
  placeholder: string
}>()
const emit = defineEmits<{
  update: [patch: Partial<Pick<PlanRecord, 'status' | 'notes' | 'articleIds' | 'questionIds'>>]
  retry: []
}>()
const statuses: PlanStatus[] = ['todo', 'active', 'completed']
const availableArticles = computed(() =>
  articles.filter((item) => !props.record?.articleIds.includes(item.id)),
)
const availableQuestions = computed(() =>
  questions.filter((item) => !props.record?.questionIds.includes(item.id)),
)
function statusLabel(status: PlanStatus) {
  return props.kind === 'task'
    ? planStatusLabels[status]
    : { todo: '待整理', active: '整理中', completed: '可讲述' }[status]
}
function addLink(kind: 'articleIds' | 'questionIds', event: Event) {
  const select = event.target as HTMLSelectElement
  if (select.value) emit('update', { [kind]: [...(props.record?.[kind] || []), select.value] })
  select.value = ''
}
</script>

<template>
  <div class="plan-editor">
    <div class="plan-statuses" :aria-label="kind === 'task' ? '任务状态' : '案例整理状态'">
      <button
        v-for="status in statuses"
        :key="status"
        type="button"
        :class="{ selected: (record?.status || 'todo') === status }"
        :aria-pressed="(record?.status || 'todo') === status"
        :disabled="disabled"
        @click="emit('update', { status })"
      >
        {{ statusLabel(status) }}
      </button>
    </div>
    <label :for="`${id}-notes`">{{ kind === 'task' ? '实践与复盘' : '我的案例草稿' }}</label>
    <textarea
      :id="`${id}-notes`"
      :value="record?.notes || ''"
      :placeholder="placeholder"
      :disabled="disabled"
      maxlength="20000"
      :rows="kind === 'task' ? 6 : 9"
      @input="emit('update', { notes: ($event.target as HTMLTextAreaElement).value })"
    ></textarea>
    <div class="plan-save-status" role="status" aria-live="polite">
      <template v-if="error"
        ><span>尚未保存，文字仍保留在当前页面。</span
        ><button type="button" class="subtle-link" @click="emit('retry')">
          <RefreshCw :size="13" /> 重试保存
        </button></template
      >
      <span v-else-if="disabled">正在读取本地记录…</span>
      <span v-else-if="saving">正在保存…</span>
      <span v-else-if="record">已保存到本机 · 可在设置中导出备份</span>
      <span v-else>填写后自动保存到本机</span>
    </div>
    <details class="plan-linked-materials">
      <summary>
        关联笔记与练习
        <span>{{ (record?.articleIds.length || 0) + (record?.questionIds.length || 0) }}</span>
      </summary>
      <p>把已有笔记和题目接到这次实践，随时回去阅读与练习。</p>
      <div class="plan-link-selects">
        <label :for="`${id}-article`"
          >关联笔记
          <select
            :id="`${id}-article`"
            :disabled="disabled || !availableArticles.length"
            @change="addLink('articleIds', $event)"
          >
            <option value="">选择已有笔记</option>
            <option v-for="article in availableArticles" :key="article.id" :value="article.id">
              {{ article.title }}
            </option>
          </select>
        </label>
        <label :for="`${id}-question`"
          >关联练习
          <select
            :id="`${id}-question`"
            :disabled="disabled || !availableQuestions.length"
            @change="addLink('questionIds', $event)"
          >
            <option value="">选择已有题目</option>
            <option v-for="question in availableQuestions" :key="question.id" :value="question.id">
              {{ question.title }}
            </option>
          </select>
        </label>
      </div>
      <div v-if="record?.articleIds.length || record?.questionIds.length" class="plan-linked-list">
        <div v-for="articleId in record?.articleIds" :key="`article-${articleId}`">
          <a :href="`#/article/${articleId}`"
            >{{ articles.find((item) => item.id === articleId)?.title || `待恢复笔记：${articleId}`
            }}<ArrowUpRight :size="14"
          /></a>
          <button
            type="button"
            :disabled="disabled"
            :aria-label="`取消关联笔记 ${articleId}`"
            @click="
              emit('update', {
                articleIds: record!.articleIds.filter((item) => item !== articleId),
              })
            "
          >
            <X :size="15" />
          </button>
        </div>
        <div v-for="questionId in record?.questionIds" :key="`question-${questionId}`">
          <a :href="`#/practice/${questionId}`"
            >{{
              questions.find((item) => item.id === questionId)?.title ||
              `待恢复题目：${questionId}`
            }}<ArrowUpRight :size="14"
          /></a>
          <button
            type="button"
            :disabled="disabled"
            :aria-label="`取消关联练习 ${questionId}`"
            @click="
              emit('update', {
                questionIds: record!.questionIds.filter((item) => item !== questionId),
              })
            "
          >
            <X :size="15" />
          </button>
        </div>
      </div>
    </details>
  </div>
</template>
