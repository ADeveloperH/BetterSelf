<script setup lang="ts">
import { ExternalLink, ShieldCheck } from '@lucide/vue'
import type { Source } from '../types'
defineProps<{ sources: Source[]; applicability: string; verifiedAt: string }>()
</script>

<template>
  <aside class="sources-box">
    <h3><ShieldCheck :size="17" /> 参考与适用范围</h3>
    <p>{{ applicability }}</p>
    <a
      v-for="source in sources"
      :key="source.url"
      :href="source.url"
      target="_blank"
      rel="noopener noreferrer"
      >{{ source.title }} <ExternalLink :size="13"
    /></a>
    <span class="sources-date">文档核验 {{ verifiedAt }} · 示例代码待项目环境验证</span>
  </aside>
</template>
