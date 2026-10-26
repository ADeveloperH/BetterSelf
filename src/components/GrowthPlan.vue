<script setup lang="ts">
import { computed } from 'vue'
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  Flag,
  LockKeyhole,
  Map,
  NotebookPen,
} from '@lucide/vue'
import PlanRecordEditor from './PlanRecordEditor.vue'
import { articles, questions } from '../lib/content'
import {
  casePlaceholder,
  planCases,
  planPhases,
  planStatusLabels,
  planTasks,
  taskPlaceholder,
} from '../lib/plan'
import type { PlanKind, PlanRecord } from '../types'

const props = defineProps<{
  route: string
  records: Record<string, PlanRecord>
  ready: boolean
  pending: Record<string, number>
  errors: Record<string, boolean>
}>()
const emit = defineEmits<{
  update: [
    id: string,
    kind: PlanKind,
    patch: Partial<Pick<PlanRecord, 'status' | 'notes' | 'articleIds' | 'questionIds'>>,
  ]
  retry: [id: string]
  back: []
}>()
const completed = computed(
  () => planTasks.filter((task) => props.records[task.id]?.status === 'completed').length,
)
const readyCases = computed(
  () => planCases.filter((item) => props.records[item.id]?.status === 'completed').length,
)
const nextTask = computed(
  () =>
    planTasks.find((task) => props.records[task.id]?.status === 'active') ||
    planTasks.find((task) => props.records[task.id]?.status !== 'completed') ||
    planTasks.at(-1)!,
)
const taskWeek = computed(() => Number(props.route.match(/^\/plan\/week\/(\d+)$/)?.[1] || 0))
const selectedTask = computed(() => planTasks.find((task) => task.week === taskWeek.value))
const caseId = computed(() => props.route.match(/^\/plan\/cases\/([^/]+)$/)?.[1] || '')
const currentCase = computed(() => planCases.find((item) => item.id === caseId.value))
const suggestedArticles = computed(() =>
  articles.filter((item) => selectedTask.value?.articleIds?.includes(item.id)),
)
const suggestedQuestions = computed(() =>
  questions.filter((item) => selectedTask.value?.questionIds?.includes(item.id)),
)
function phaseProgress(phase: number) {
  return planTasks.filter(
    (task) => task.phase === phase && props.records[task.id]?.status === 'completed',
  ).length
}
</script>

<template>
  <div class="growth-plan">
    <template v-if="route === '/plan'">
      <div class="page-heading">
        <div class="eyebrow">让工作经验，成为面试底气</div>
        <h1 tabindex="-1">本周计划<span class="accent-period">。</span></h1>
        <p>每周 3～4 小时，从现有项目出发，留下能解释、能验证的积累。</p>
      </div>
      <section class="plan-summary" aria-label="计划概况">
        <div>
          <span>路线进度</span><strong>{{ completed }} / 24</strong>
          <progress
            :value="completed"
            max="24"
            :aria-label="`已完成 ${completed} 项周任务`"
          ></progress>
        </div>
        <div>
          <span>可讲案例</span><strong>{{ readyCases }} / 4</strong>
        </div>
        <div><span>当前方向</span><strong>Unity 休闲游戏客户端</strong></div>
      </section>

      <nav class="plan-section-nav" aria-label="计划内容">
        <a href="#/plan" class="active"><Flag :size="17" /> 本周</a>
        <a href="#/plan/roadmap"><Map :size="17" /> 路线</a>
        <a href="#/plan/cases"><BriefcaseBusiness :size="17" /> 案例</a>
      </nav>

      <section class="panel plan-week-card" aria-labelledby="current-week-title">
        <div class="plan-week-number">第 {{ nextTask.week }} 周</div>
        <span class="plan-kicker">{{ planPhases[nextTask.phase]!.title }}</span>
        <h2 id="current-week-title">{{ nextTask.title }}</h2>
        <ul class="plan-actions">
          <li v-for="action in nextTask.actions" :key="action">{{ action }}</li>
        </ul>
        <div class="plan-outcome">
          <NotebookPen :size="18" />
          <div>
            <span>本周留下</span>
            <p>{{ nextTask.outcome }}</p>
          </div>
        </div>
        <a :href="`#/plan/week/${nextTask.week}`" class="primary-button">
          {{ records[nextTask.id]?.notes ? '继续记录' : '开始本周任务' }}
          <ArrowRight :size="16" />
        </a>
      </section>

      <div class="plan-local-note">
        <LockKeyhole :size="15" /><span>实践记录和案例草稿仅保存在本机，并随备份导出。</span>
      </div>

      <section class="plan-quick-links">
        <a href="#/plan/roadmap"
          ><Map :size="20" /><span
            ><strong>查看完整路线</strong><small>20 周主线与 4 周缓冲</small></span
          ><ChevronRight :size="17"
        /></a>
        <a href="#/plan/cases"
          ><BriefcaseBusiness :size="20" /><span
            ><strong>整理经验案例</strong><small>把职责、取舍和证据串起来</small></span
          ><ChevronRight :size="17"
        /></a>
      </section>
    </template>

    <template v-else-if="route === '/plan/roadmap'">
      <div class="detail-topline">
        <button class="subtle-link page-back" @click="$emit('back')">
          <ArrowLeft :size="16" /> 返回本周计划
        </button>
      </div>
      <div class="page-heading compact-heading">
        <div class="eyebrow">20 周主线＋4 周缓冲</div>
        <h1 tabindex="-1">行动路线<span class="accent-period">。</span></h1>
        <p>每周只留下一个可以检查的结果，顺序可根据实际工作调整。</p>
      </div>
      <nav class="plan-section-nav" aria-label="计划内容">
        <a href="#/plan"><Flag :size="17" /> 本周</a>
        <a href="#/plan/roadmap" class="active"><Map :size="17" /> 路线</a>
        <a href="#/plan/cases"><BriefcaseBusiness :size="17" /> 案例</a>
      </nav>
      <div class="plan-roadmap">
        <details
          v-for="(phase, index) in planPhases"
          :key="phase.title"
          class="panel plan-phase"
          :open="index === nextTask.phase"
        >
          <summary>
            <span class="plan-phase-number">{{ String(index + 1).padStart(2, '0') }}</span>
            <span class="plan-phase-title"
              ><small>{{ phase.weeks }}</small
              ><strong>{{ phase.title }}</strong></span
            >
            <span class="plan-phase-count">{{ phaseProgress(index) }} / 4</span
            ><ChevronRight :size="17" />
          </summary>
          <p>{{ phase.goal }}</p>
          <a
            v-for="task in planTasks.filter((item) => item.phase === index)"
            :key="task.id"
            :href="`#/plan/week/${task.week}`"
            class="plan-task-row"
          >
            <span
              class="plan-task-marker"
              :class="{ complete: records[task.id]?.status === 'completed' }"
            >
              <Check v-if="records[task.id]?.status === 'completed'" :size="14" /><span v-else>{{
                task.week
              }}</span>
            </span>
            <span>{{ task.title }}</span
            ><small>{{ planStatusLabels[records[task.id]?.status || 'todo'] }}</small
            ><ChevronRight :size="15" />
          </a>
        </details>
      </div>
    </template>

    <template v-else-if="selectedTask">
      <div class="detail-topline">
        <button class="subtle-link page-back" @click="$emit('back')">
          <ArrowLeft :size="16" /> 返回行动路线
        </button>
      </div>
      <section class="plan-task-detail" aria-labelledby="plan-task-title">
        <span class="plan-kicker"
          >第 {{ selectedTask.week }} 周 · {{ planPhases[selectedTask.phase]!.title }}</span
        >
        <h1 id="plan-task-title" tabindex="-1">{{ selectedTask.title }}</h1>
        <ul class="plan-actions">
          <li v-for="action in selectedTask.actions" :key="action">{{ action }}</li>
        </ul>
        <div class="plan-outcome">
          <NotebookPen :size="18" />
          <div>
            <span>本周留下</span>
            <p>{{ selectedTask.outcome }}</p>
          </div>
        </div>
        <div v-if="suggestedArticles.length || suggestedQuestions.length" class="plan-suggestions">
          <span>可以从这里开始</span>
          <a
            v-for="article in suggestedArticles"
            :key="article.id"
            :href="`#/article/${article.id}`"
            >{{ article.title }}<ChevronRight :size="14"
          /></a>
          <a
            v-for="question in suggestedQuestions"
            :key="question.id"
            :href="`#/practice/${question.id}`"
            >{{ question.title }}<ChevronRight :size="14"
          /></a>
        </div>
        <PlanRecordEditor
          :id="selectedTask.id"
          :key="selectedTask.id"
          kind="task"
          :record="records[selectedTask.id]"
          :disabled="!ready"
          :saving="!!pending[selectedTask.id]"
          :error="!!errors[selectedTask.id]"
          :placeholder="taskPlaceholder"
          @update="emit('update', selectedTask.id, 'task', $event)"
          @retry="emit('retry', selectedTask.id)"
        />
        <a
          v-if="selectedTask.week < 24"
          :href="`#/plan/week/${selectedTask.week + 1}`"
          class="subtle-link plan-next"
          >查看第 {{ selectedTask.week + 1 }} 周 <ArrowRight :size="15"
        /></a>
      </section>
    </template>

    <template v-else-if="route === '/plan/cases'">
      <div class="detail-topline">
        <button class="subtle-link page-back" @click="$emit('back')">
          <ArrowLeft :size="16" /> 返回本周计划
        </button>
      </div>
      <div class="page-heading compact-heading">
        <div class="eyebrow">从经历，到可以讲清楚的证据</div>
        <h1 tabindex="-1">经验案例<span class="accent-period">。</span></h1>
        <p>先写清代码来源和自己的职责，再补方案、验证与不足。</p>
      </div>
      <nav class="plan-section-nav" aria-label="计划内容">
        <a href="#/plan"><Flag :size="17" /> 本周</a>
        <a href="#/plan/roadmap"><Map :size="17" /> 路线</a>
        <a href="#/plan/cases" class="active"><BriefcaseBusiness :size="17" /> 案例</a>
      </nav>
      <div class="plan-case-list panel">
        <a v-for="(item, index) in planCases" :key="item.id" :href="`#/plan/cases/${item.id}`">
          <span class="plan-case-index">{{ index === 3 ? '备用' : `0${index + 1}` }}</span>
          <span
            ><strong>{{ item.title }}</strong
            ><small>{{ item.description }}</small></span
          >
          <em>{{
            records[item.id]?.status === 'completed'
              ? '可讲述'
              : records[item.id]?.status === 'active'
                ? '整理中'
                : '待整理'
          }}</em>
          <ChevronRight :size="17" />
        </a>
      </div>
      <div class="plan-local-note">
        <LockKeyhole :size="15" /><span
          >案例草稿可能包含工作信息，只保存在本机，不会随网站版本公开。</span
        >
      </div>
    </template>

    <template v-else-if="currentCase">
      <div class="detail-topline">
        <button class="subtle-link page-back" @click="$emit('back')">
          <ArrowLeft :size="16" /> 返回经验案例
        </button>
      </div>
      <section class="plan-task-detail" aria-labelledby="plan-case-title">
        <span class="plan-kicker">经验案例</span>
        <h1 id="plan-case-title" tabindex="-1">{{ currentCase.title }}</h1>
        <p class="plan-case-description">{{ currentCase.description }}</p>
        <details class="plan-prompts" open>
          <summary>用这三个问题检查深度</summary>
          <ul>
            <li v-for="prompt in currentCase.prompts" :key="prompt">{{ prompt }}</li>
          </ul>
        </details>
        <PlanRecordEditor
          :id="currentCase.id"
          :key="currentCase.id"
          kind="case"
          :record="records[currentCase.id]"
          :disabled="!ready"
          :saving="!!pending[currentCase.id]"
          :error="!!errors[currentCase.id]"
          :placeholder="casePlaceholder"
          @update="emit('update', currentCase.id, 'case', $event)"
          @retry="emit('retry', currentCase.id)"
        />
      </section>
    </template>
  </div>
</template>
