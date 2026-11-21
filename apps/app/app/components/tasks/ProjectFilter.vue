<template>
  <USelectMenu
    v-bind="$attrs"
    v-model="projects"
    v-model:search-term="search"
    value-key="id"
    label-key="title"
    placeholder="Select projects"
    :items="items"
    :loading="loading"
    multiple
    ignore-filter
  />
  <span v-if="error" role="status" class="text-sm text-error">Projects could not be loaded.</span>
</template>

<script setup lang="ts">
import { projectFilterLimit } from '@workboard/contracts';

defineOptions({ inheritAttrs: false });
const projects = defineModel<string[]>({ required: true });
const { search, items, loading, error } = useProjectLookup(
  projects,
  /** At the limit, existing selections can still be removed. */
  (item) => projects.value.length >= projectFilterLimit && !projects.value.includes(item.id),
);
</script>
