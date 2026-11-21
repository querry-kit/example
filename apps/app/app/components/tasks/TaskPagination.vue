<template>
  <QTablePagination
    v-model:page="page"
    v-model:items-per-page="itemsPerPage"
    :aria-busy="branch.loading"
    :total-items="totalItems"
    :shortcuts="!scrolling && !path.length"
    :ui="{
      root: path.length ? 'shrink-0 gap-2! py-1!' : 'shrink-0',
      right: 'min-w-0 max-w-full flex-wrap [&_[data-slot=list]]:flex-wrap',
    }"
  >
    <template #left="{ start, end }">
      <slot />
      <p
        class="text-muted"
        aria-live="polite"
        :class="[path.length ? 'text-xs' : 'text-sm', { 'animate-pulse': branch.loading }]"
      >
        Showing {{ scrolling ? Number(branch.items.length > 0) : start }}–{{ scrolling ? branch.items.length : end }}
        of
        {{ totalItems }}
      </p>
    </template>
    <template v-if="scrolling" #page-size />
    <template v-if="scrolling || path.length" #pagination>
      <QTableGroupLoadMore
        v-if="scrolling"
        :size="path.length ? 'sm' : undefined"
        :has-more="branch.hasMore && !branch.error"
        :loading="branch.loading"
        @load="loadMore"
      />
      <UPagination v-else v-model:page="page" size="sm" :items-per-page="itemsPerPage" :total="totalItems" />
    </template>
  </QTablePagination>
</template>

<script setup lang="ts">
import type { GroupBranch, GroupPath } from '@querry-kit/nuxt';
import type { Task } from '@workboard/contracts';

import type { TaskGroupTable } from '~/utils/group-table';

const { table, path } = defineProps<{ table: TaskGroupTable; path: GroupPath; branch: GroupBranch<Task> }>();
const { loadingMode, itemsPerPage } = table;
const scrolling = computed(/** Uses the shared row loading mode. */ () => loadingMode.value === 'infinite');
const totalItems = computed(
  /** Counts every matching record in this branch. */ () => table.getItemPage(path).totalItems,
);
const page = computed({
  /** Reads the page independently for each leaf. */
  get: () => table.getItemPage(path).page,
  /** Loads only this leaf's requested page. */
  set: (value) => void table.loadItemsPage(path, value),
});

/** Appends the next item batch for this branch. */
function loadMore(): void {
  void table.loadMoreItems(path);
}
</script>
