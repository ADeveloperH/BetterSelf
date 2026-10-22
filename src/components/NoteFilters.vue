<script setup lang="ts">
import { computed } from 'vue'
import { articles, domains } from '../lib/content'
import { emptyNoteFilters, noteTypeLabels, type NoteFilters } from '../lib/notes'
const filters = defineModel<NoteFilters>({ required: true })
const populatedDomains = computed(() =>
  domains.filter((domain) => articles.some((article) => article.domainId === domain.id)),
)
const categories = computed(
  () =>
    domains
      .find((domain) => domain.id === filters.value.domain)
      ?.categories.filter((category) =>
        articles.some(
          (article) =>
            article.domainId === filters.value.domain && article.categoryId === category.id,
        ),
      ) || [],
)
const types = computed(() => [...new Set(articles.map((article) => article.noteType))])
const tags = computed(() => [...new Set(articles.flatMap((article) => article.tags))])
</script>

<template>
  <div class="note-filters" role="group" aria-label="筛选笔记">
    <label
      >主题<select v-model="filters.domain" @change="filters.category = ''">
        <option value="">全部主题</option>
        <option v-for="domain in populatedDomains" :key="domain.id" :value="domain.id">
          {{ domain.title }}
        </option>
      </select></label
    >
    <label
      >子分类<select v-model="filters.category" :disabled="!filters.domain">
        <option value="">全部子分类</option>
        <option v-for="category in categories" :key="category.id" :value="category.id">
          {{ category.title }}
        </option>
      </select></label
    >
    <label
      >类型<select v-model="filters.type">
        <option value="">全部类型</option>
        <option v-for="type in types" :key="type" :value="type">{{ noteTypeLabels[type] }}</option>
      </select></label
    >
    <label
      >标签<select v-model="filters.tag">
        <option value="">全部标签</option>
        <option v-for="tag in tags" :key="tag" :value="tag">{{ tag }}</option>
      </select></label
    >
    <button
      v-if="Object.values(filters).some(Boolean)"
      class="subtle-link"
      @click="filters = emptyNoteFilters()"
    >
      清除筛选
    </button>
  </div>
</template>
