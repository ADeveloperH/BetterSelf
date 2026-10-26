<script setup lang="ts">
import { ExternalLink, ShieldCheck } from '@lucide/vue'
import type { Source } from '../types'
defineProps<{ sources: Source[]; applicability: string; verifiedAt: string | null }>()
</script>

<template>
  <aside class="sources-box">
    <h3><ShieldCheck :size="17" /> 参考与适用范围</h3>
    <p>{{ applicability }}</p>
    <template v-for="(source, index) in sources" :key="index">
      <span v-if="source.kind === 'personal'" class="source-personal"
        >{{ source.title }} · 个人记录</span
      >
      <a v-else :href="source.url" rel="noreferrer"
        >{{ source.title }} <ExternalLink :size="13"
      /></a>
    </template>
    <span class="sources-date">{{ verifiedAt ? `内容核验 ${verifiedAt}` : '内容尚未核验' }}</span>
  </aside>
</template>
