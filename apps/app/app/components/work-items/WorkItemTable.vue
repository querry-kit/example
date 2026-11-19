<template>
  <section aria-labelledby="work-items-heading" class="min-w-0 space-y-4">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 id="work-items-heading" class="text-2xl font-semibold">
          Work items
        </h1>
        <p class="text-sm text-muted">
          Filter, sort, and project real data from the active demo account.
        </p>
      </div>
      <WorkItemsProjectLookup v-model="project" />
    </div>

    <div class="min-w-0 overflow-hidden rounded-lg border border-default bg-default">
      <!-- Controls only manage intent. useTable below translates it into server requests. -->
      <QTableToolbar
        v-model:search="search"
        v-model:filtering="toolbarFiltering"
        v-model:sorting="sorting"
        v-model:column-order="columnOrder"
        v-model:invisible-columns="columnVisibility"
        v-model:column-pinning="columnPinning"
        search-placeholder="Search work items"
        :filter-fields="workItemFilterFields"
        :sortable-fields="workItemSortableFields"
        :column-definitions="columnOptions"
        :ui="{ primary: 'min-w-0', secondary: 'min-w-0' }"
      />
      <UAlert
        v-if="error"
        class="m-4"
        color="error"
        variant="soft"
        title="Could not load work items"
        :actions="[{ label: 'Retry', onClick: refresh }]"
      />
      <div class="overflow-x-auto">
        <UTable
          empty="No matching work items"
          :data="items"
          :columns="columns"
          :column-pinning="columnPinning"
          :loading="loading"
        >
          <template #status-cell="{ row }">
            <UBadge variant="soft" :label="row.original.status" />
          </template>
          <template #labels-cell="{ row }">
            <ul v-if="row.original.labels?.length" class="flex flex-wrap gap-1" aria-label="Labels">
              <li v-for="label in row.original.labels" :key="label.id">
                <UBadge color="neutral" variant="subtle" :label="label.displayName" />
              </li>
            </ul>
            <span v-else>—</span>
          </template>
          <template #actions-cell="{ row }">
            <UButton
              v-if="row.original.id"
              color="neutral"
              variant="ghost"
              size="xs"
              label="Open"
              :to="`/work-items/${row.original.id}`"
              :aria-label="`Open ${row.original.title ?? row.original.id}`"
            />
          </template>
        </UTable>
      </div>

      <QTablePagination v-model:page="page" v-model:items-per-page="itemsPerPage" :total-items="totalItems" />
    </div>
  </section>
</template>

<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui';
import { useTable, type TableColumnInput } from '@querry-kit/nuxt';
import type { ColumnDefinition, Filtering } from '@querry-kit/nuxt-ui/types';
import { refDebounced } from '@vueuse/core';
import { resourceIdSchema, type DemoSession, type WorkItem } from '@workboard/contracts';

import { workItemFilterFields, workItemSortableFields, workItemStaticWhere } from '~/utils/work-item-controls';

const props = defineProps<{ session: DemoSession }>();
const { $workboardApi } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const search = ref('');
const debouncedSearch = refDebounced(search, 250);
const initialProject = resourceIdSchema.safeParse(route.query.project);
const project = ref(initialProject.success ? initialProject.data : undefined);

/** Keeps the selected project linkable and rehydrates it on reload. */
function persistProject(value: string | undefined): void {
  void router.replace({ query: { ...route.query, project: value } });
}

watch(project, persistProject);

const staticFilter = computed(
  /** Validates the search and relation filters using the same contract as the API. */
  () => workItemStaticWhere(debouncedSearch.value, project.value),
);

/** Renders the title from the projected relation rather than passing the object to the renderer. */
function projectTitle(item: WorkItem): string {
  return item.project?.title ?? '—';
}

/** Renders a public account name without exposing any additional account data. */
function ownerName(item: WorkItem): string {
  return item.owner?.profile?.displayName ?? '—';
}

/** Combines Query Kit projection metadata with the Nuxt UI column renderer. */
type WorkItemColumn = TableColumnInput<WorkItem, TableColumn<WorkItem>>;

const allColumns: WorkItemColumn[] = [
  { id: 'title', accessorKey: 'title', header: 'Title', enableHiding: false },
  { id: 'status', accessorKey: 'status', header: 'Status' },
  { id: 'priority', accessorKey: 'priority', header: 'Priority' },
  { id: 'project', accessorFn: projectTitle, header: 'Project', fields: ['title'] },
  { id: 'owner', accessorFn: ownerName, header: 'Owner', fields: ['profile.displayName'] },
  { id: 'estimatedHours', accessorKey: 'estimatedHours', header: 'Est. hours' },
  { id: 'labels', accessorKey: 'labels', header: 'Labels', fields: ['id', 'displayName'] },
  { id: 'internalNote', accessorKey: 'internalNote', header: 'Internal note' },
  { id: 'internalCostCents', accessorKey: 'internalCostCents', header: 'Internal cost (¢)' },
  { id: 'actions', header: 'Open', enableHiding: false },
];

const availableColumns = computed(
  /** Offers only authorized columns. The API independently checks projection requests. */
  () => {
    const fields = new Set<string>(props.session.fields);
    return allColumns.filter(
      /** Keeps the action slot or a field advertised for the active account. */
      ({ id }) => id === 'actions' || Boolean(id && fields.has(id)),
    );
  },
);

const columnOptions = computed<ColumnDefinition[]>(
  /** Exposes display labels, not renderer callbacks, to the column configuration panel. */
  () =>
    availableColumns.value.flatMap(
      /** Omits any column without a selectable identifier or string label. */
      ({ id, header, enableHiding }) => (id && typeof header === 'string' ? [{ id, header, enableHiding }] : []),
    ),
);

// The headless table owns projections, preferences, sorting, and server pagination.
// https://querry-kit.github.io/querry-kit/docs/nuxt/api/table/
// https://querry-kit.github.io/querry-kit/docs/nuxt-ui/components/toolbar/
const {
  columns,
  items,
  page,
  itemsPerPage,
  totalItems,
  loading,
  error,
  sorting,
  filtering,
  columnOrder,
  columnVisibility,
  columnPinning,
  initialize,
  refresh,
} = useTable<WorkItem, WorkItemColumn>({
  api: $workboardApi,
  endpoint: 'work-items',
  columns: availableColumns,
  persistenceKey: `work-items:${props.session.id}`,
  staticFilter,
  defaultItemsPerPage: 2,
});

const toolbarFiltering = computed<Filtering>({
  /** Narrows the shared table state to the filter inputs emitted by these Nuxt UI controls. */
  get: () => filtering.value as Filtering,
  /** Starts the filtered result set on its first page. */
  set: (value) => {
    page.value = 1;
    filtering.value = value;
  },
});

/** Returns to page one when search, the selected project, or sorting changes. */
function resetPage(): void {
  page.value = 1;
}

watch([debouncedSearch, project, sorting], resetPage, { deep: true });
onMounted(initialize);
</script>
