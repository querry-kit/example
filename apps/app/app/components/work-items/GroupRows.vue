<template>
  <div class="min-w-0 space-y-2">
    <div class="overflow-x-auto">
      <UTable empty="No matching work items" :data="branch.items" :columns="columns" :loading="branch.loading">
        <template #title-cell="{ row }">
          <NuxtLink v-if="row.original.id" class="font-medium text-primary" :to="`/work-items/${row.original.id}`">
            {{ row.original.title }}
          </NuxtLink>
        </template>
      </UTable>
    </div>
    <QTablePagination
      v-if="loadingMode === 'pagination'"
      v-model:page="page"
      v-model:items-per-page="itemsPerPage"
      :total-items="table.getItemPage(path).totalItems"
    />
    <QTableGroupLoadMore
      v-else
      :has-more="branch.hasMore"
      :loading="branch.loading"
      :error="branch.error"
      @load="loadMore"
    />
  </div>
</template>

<script setup lang="ts">
import type { GroupBranch, GroupPath } from '@querry-kit/nuxt';
import type { WorkItem } from '@workboard/contracts';
import type { WorkItemGroupTable } from '~/utils/group-table';

const props = defineProps<{ table: WorkItemGroupTable; path: GroupPath; branch: GroupBranch<WorkItem> }>();
const { columns, loadingMode, itemsPerPage } = props.table;
const page = computed({
  /** Shows the current page for this specific leaf. */
  get: () => props.table.getItemPage(props.path).page,
  /** Loads only this leaf's requested page. */
  set: (value) => void props.table.loadItemsPage(props.path, value),
});

/** Appends the next item batch in infinite mode. */
function loadMore(): void {
  void props.table.loadMoreItems(props.path);
}
</script>
