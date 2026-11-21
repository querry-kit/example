<template>
  <UFormField label="Project" :name="name" :required="Boolean(name)">
    <USelectMenu
      v-model="project"
      v-model:search-term="search"
      size="sm"
      value-key="id"
      label-key="title"
      aria-label="Project"
      class="w-full"
      placeholder="Select a project"
      :items="items"
      :loading="loading"
      ignore-filter
    />
    <span v-if="error" role="status" class="mt-1 block text-sm text-error">Projects could not be loaded.</span>
  </UFormField>
</template>

<script setup lang="ts">
import { useAutocomplete } from '@querry-kit/nuxt';
import { refDebounced } from '@vueuse/core';
import type { ProjectLookup } from '@workboard/contracts';

defineProps<{ name?: string }>();
const project = defineModel<string>();
const search = ref('');
const debounced = refDebounced(search, 250);
const { $workboardApi } = useNuxtApp();

const query = computed(
  /** Builds a title search, leaving the selected ID to Query Kit's hydration request. */
  () => {
    const title = debounced.value.trim().slice(0, 160);
    return title ? { where: { title: { contains: title, mode: 'insensitive' } }, perPage: 10 } : { perPage: 10 };
  },
);

// The composable keeps the selected value separate from the current page of search results.
// https://querry-kit.github.io/querry-kit/docs/nuxt/guide/autocomplete/
const { items, loading, error } = useAutocomplete<ProjectLookup>({
  api: $workboardApi,
  endpoint: 'projects',
  currentValue: project,
  query,
});
</script>
