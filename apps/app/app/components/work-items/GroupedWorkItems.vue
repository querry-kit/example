<template>
  <section class="min-w-0 space-y-4" aria-labelledby="groups-heading">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 id="groups-heading" class="text-2xl font-semibold">
          Grouped work items
        </h1>
        <p class="text-sm text-muted">
          Expand a group to load its records. Counts always cover the filtered dataset; effort metrics are optional.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <USwitch v-model="showMetrics" label="Show effort metrics" />
        <USelect v-model="loadingMode" aria-label="Load group records" :items="modes" />
      </div>
    </div>

    <div class="min-w-0 overflow-hidden rounded-lg border border-default bg-default">
      <QTableToolbar
        v-model:search="search"
        v-model:filtering="toolbarFiltering"
        v-model:sorting="sorting"
        v-model:grouping="grouping"
        search-placeholder="Search grouped work items"
        :filter-fields="workItemFilterFields"
        :sortable-fields="workItemSortableFields"
        :groupable-fields="groupableFields"
      />
      <div class="space-y-2 p-3">
        <UAlert
          v-if="root.error"
          color="error"
          variant="soft"
          title="Could not load groups"
          :actions="[{ label: 'Retry', onClick: refresh }]"
        />
        <template v-else-if="grouping.length">
          <WorkItemsGroupBranch
            v-for="node in groups"
            :key="node.key"
            :table="table"
            :node="node"
            :filter="filter"
            :show-metrics="showMetrics"
          />
          <p v-if="!root.loading && !groups.length" class="p-3 text-sm text-muted">
            No matching groups
          </p>
          <QTableGroupLoadMore :has-more="root.hasMore" :loading="root.loading" @load="loadGroups" />
        </template>
        <WorkItemsGroupRows v-else :table="table" :path="[]" :branch="root" />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { andWhere, filteringToWhere, useGroupedTable } from '@querry-kit/nuxt';
import type { Filtering } from '@querry-kit/nuxt-ui/types';
import { refDebounced } from '@vueuse/core';
import type { DemoSession, WorkItem } from '@workboard/contracts';
import type { Ref } from 'vue';

import type { GroupItemColumn } from '~/utils/group-table';
import { workItemFilterFields, workItemSortableFields, workItemStaticWhere } from '~/utils/work-item-controls';

const props = defineProps<{ session: DemoSession }>();
const { $workboardApi } = useNuxtApp();
const search = ref('');
const debounced = refDebounced(search, 250);
const showMetrics = ref(false);
const groupableFields = [
  { value: 'status', label: 'Status' },
  { value: 'priority', label: 'Priority' },
];
const modes = [
  { label: 'Pages', value: 'pagination' as const },
  { label: 'Load more', value: 'infinite' as const },
];
const columns = ref<GroupItemColumn[]>([
  { id: 'title', accessorKey: 'title', header: 'Title' },
  { id: 'status', accessorKey: 'status', header: 'Status' },
  { id: 'priority', accessorKey: 'priority', header: 'Priority' },
  { id: 'estimatedHours', accessorKey: 'estimatedHours', header: 'Estimated hours' },
]);
const staticFilter = computed(
  /** Uses the same title search as the flat table. */
  () => workItemStaticWhere(debounced.value),
);

// Query Kit loads group counts and child branches; the app supplies columns, labels, and optional metrics.
// https://querry-kit.github.io/querry-kit/docs/nuxt/api/table/
// https://querry-kit.github.io/querry-kit/docs/nuxt-ui/components/grouping/
const table = useGroupedTable<WorkItem, GroupItemColumn>({
  api: $workboardApi,
  endpoint: 'work-items',
  persistenceKey: `work-item-groups:${props.session.id}`,
  columns,
  groupableFields,
  defaultGrouping: ['status'],
  groupBatchSize: 2,
  defaultItemsPerPage: 1,
  staticFilter,
  loading: { initialMode: 'pagination', initialGroupItems: 1, groupLoadMoreItems: 1, preloadGroupItems: false },
});
const { root, groups, grouping, loadingMode, sorting, filtering, refresh, initialize } = table;
const toolbarFiltering = filtering as Ref<Filtering>;
const filter = computed(
  /** Metrics must use exactly the filter from which this tree was built. */
  () => andWhere(staticFilter.value, filteringToWhere(filtering.value)),
);

/** Loads the next root batch without refetching already expanded branches. */
function loadGroups(): void {
  void table.loadMoreGroups();
}

onMounted(initialize);
</script>
