<template>
  <WorkboardPanel title="Tasks" full-page>
    <DefineLoadingModeSwitch>
      <UTooltip :text="loadingMode === 'infinite' ? 'Infinite scroll' : 'Pagination'">
        <USwitch
          v-model="loadingMode"
          true-value="infinite"
          false-value="pagination"
          checked-icon="i-tabler-infinity"
          unchecked-icon="i-tabler-list-numbers"
          aria-label="Infinite scroll"
        />
      </UTooltip>
    </DefineLoadingModeSwitch>

    <template #toolbar>
      <!-- Controls only manage intent. The headless table translates it into server requests. -->
      <QTableToolbar
        v-model:search="search"
        v-model:filtering="toolbarFiltering"
        v-model:sorting="sorting"
        v-model:grouping="grouping"
        v-model:column-order="columnOrder"
        v-model:invisible-columns="columnVisibility"
        v-model:column-pinning="columnPinning"
        search-placeholder="Search tasks"
        :filter-fields="filterFields"
        :sortable-fields="sortableFields"
        :groupable-fields="groupableFields"
        :column-definitions="columnOptions"
        :ui="{ primary: 'min-w-0', secondary: 'min-w-0' }"
      >
        <template #filter-item="{ filter, remove }">
          <template v-if="filter.field === 'project'">
            <TasksProjectLookup v-model="project" class="min-w-0 flex-1" />
            <UButton
              class="self-end"
              color="error"
              variant="outline"
              size="sm"
              icon="i-tabler-x"
              aria-label="Remove project filter"
              @click="remove"
            />
          </template>
        </template>
        <template #new>
          <WorkboardDeleteDialog
            v-if="selectedCount || deleteOpen"
            v-model:open="deleteOpen"
            title="Delete selected tasks"
            :description="`Permanently delete ${selectedCount} selected ${selectedCount === 1 ? 'task' : 'tasks'}?`"
            :remove="deleteSelected"
            @deleted="refreshAfterDelete"
          >
            <UButton
              color="error"
              variant="outline"
              icon="i-tabler-trash"
              :label="`Delete selected (${selectedCount})`"
            />
          </WorkboardDeleteDialog>
          <TasksTaskEditor :project-id="project" @saved="openCreatedTask">
            <UButton icon="i-tabler-plus" label="New task" />
          </TasksTaskEditor>
        </template>
      </QTableToolbar>
    </template>

    <div class="flex min-h-0 min-w-0 flex-1 flex-col">
      <UAlert
        v-if="root.error"
        class="m-4 shrink-0"
        color="error"
        variant="soft"
        :title="grouping.length ? 'Could not load groups' : 'Could not load tasks'"
        :actions="[{ label: 'Retry', onClick: retry }]"
      />
      <div
        ref="viewport"
        class="@container min-h-0 flex-1 overflow-auto [scrollbar-gutter:stable]"
        tabindex="0"
        aria-label="Tasks table"
        role="region"
        @click="toggleGroupRow"
      >
        <UTable
          v-model:sorting="sorting"
          sticky
          :empty="grouping.length ? 'No matching groups' : 'No matching tasks'"
          :data="rows"
          :columns="[selectionColumn, ...displayColumns]"
          :column-pinning="displayPinning"
          :sorting-options="{ manualSorting: true }"
          :loading="root.loading"
          :get-row-id="getRowId"
          :meta="rowMeta"
          :style="grouping.length ? { '--task-table-width': `${groupedTableWidth}px` } : undefined"
          :ui="{
            ...taskTableUi,
            base: grouping.length
              ? 'min-w-(--task-table-width) w-full table-fixed overflow-visible'
              : 'min-w-[760px] w-full overflow-visible',
          }"
        >
          <template #selection-header>
            <UCheckbox
              aria-label="Select visible tasks"
              :model-value="visibleSelection"
              :disabled="!visibleTasks.length"
              @update:model-value="selectTasks(visibleTasks, $event === true)"
            />
          </template>
          <template #selection-cell="{ row }">
            <TasksTaskGroupControls
              v-if="row.original.kind === 'controls'"
              :key="row.original.key"
              :table="table"
              :node="row.original.node"
              :viewport="viewport"
              :leaf="row.original.leaf"
              :show-metrics="showMetrics"
              :filter="groupFilter"
            />
            <UCheckbox
              v-else-if="row.original.kind === 'group'"
              :aria-label="`Select group ${groupLabel(row.original.node)}`"
              :model-value="groupState(row.original.node)"
              @update:model-value="selectGroup(row.original.node, $event === true)"
            />
            <UCheckbox
              v-else-if="row.original.kind === 'task' && row.original.task.id"
              :aria-label="`Select ${row.original.task.title ?? row.original.task.id}`"
              :model-value="isSelected(row.original.task)"
              @update:model-value="selectTasks([row.original.task], $event === true)"
            />
          </template>
          <template v-for="item in displayColumns" :key="item.id" #[`${item.id}-header`]="{ column }">
            <UButton
              v-if="column.getCanSort()"
              class="p-0 font-semibold text-highlighted"
              color="neutral"
              variant="ghost"
              :label="String(item.header)"
              :trailing-icon="sortIcon(column.getIsSorted())"
              @click="column.getToggleSortingHandler()?.($event)"
            />
            <template v-else>
              {{ item.header }}
            </template>
          </template>
          <template v-for="column in displayColumns" :key="column.id" #[`${column.id}-cell`]="{ row }">
            <template v-if="row.original.kind === 'group'">
              <UButton
                v-if="column.id === row.original.node.field"
                color="neutral"
                variant="ghost"
                size="xs"
                data-group-toggle
                :aria-expanded="row.original.node.expanded"
                :aria-label="groupLabel(row.original.node)"
                :icon="row.original.node.expanded ? 'i-tabler-chevron-down' : 'i-tabler-chevron-right'"
                @click="table.toggleGroup(row.original.node.path)"
              >
                <TasksTaskValue :field="column.id" :value="row.original.node.value" />
                <span class="text-muted tabular-nums">{{ row.original.node.count }}</span>
              </UButton>
              <span
                v-else-if="column.id === 'estimatedHours'"
                aria-label="Total estimated hours"
                class="font-medium text-highlighted"
              >
                {{ row.original.node.sum?.estimatedHours ?? '—' }}
              </span>
            </template>
            <template v-else-if="row.original.kind === 'task' && !grouping.includes(column.id)">
              <ULink
                v-if="column.id === 'title' && row.original.task.id"
                class="font-medium text-highlighted hover:text-primary"
                :to="{ path: `/tasks/${row.original.task.id}`, query: { project } }"
                :aria-label="`Open ${row.original.task.title ?? row.original.task.id}`"
              >
                {{ row.original.task.title }}
              </ULink>
              <UBadge
                v-else-if="column.id === 'project' && row.original.task.project?.title"
                class="rounded-full"
                color="primary"
                variant="subtle"
                icon="i-tabler-folder"
                :label="row.original.task.project.title"
              />
              <UBadge
                v-else-if="column.id === 'owner' && row.original.task.owner?.profile?.displayName"
                class="rounded-full"
                color="neutral"
                variant="subtle"
                icon="i-tabler-user"
                :label="row.original.task.owner.profile.displayName"
              />
              <template v-else-if="column.id === 'labels'">
                <ul v-if="row.original.task.labels?.length" class="flex max-w-64 flex-wrap gap-1" aria-label="Labels">
                  <li v-for="label in row.original.task.labels" :key="label.id">
                    <UBadge
                      class="rounded-full"
                      color="neutral"
                      variant="subtle"
                      icon="i-tabler-tag"
                      :label="label.displayName"
                    />
                  </li>
                </ul>
                <span v-else>—</span>
              </template>
              <UDropdownMenu
                v-else-if="column.id === 'actions' && row.original.task.id"
                :items="[
                  {
                    label: 'Open',
                    icon: 'i-tabler-external-link',
                    to: { path: `/tasks/${row.original.task.id}`, query: { project } },
                  },
                ]"
              >
                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-tabler-dots-vertical"
                  :aria-label="`Actions for ${row.original.task.title ?? row.original.task.id}`"
                />
              </UDropdownMenu>
              <TasksTaskValue v-else :field="column.id" :value="taskValue(row.original.task, column.id)" />
            </template>
          </template>
        </UTable>
      </div>
      <footer v-if="grouping.length" class="flex flex-wrap items-center gap-3 border-t border-default px-4 py-3">
        <LoadingModeSwitch />
        <UTooltip :text="bulkGroupLabel">
          <UButton
            color="neutral"
            size="sm"
            variant="ghost"
            :icon="allGroupsExpanded ? 'i-tabler-fold-up' : 'i-tabler-fold-down'"
            :aria-label="bulkGroupLabel"
            :disabled="!groups.length || root.loading"
            :loading="changingGroups"
            @click="toggleAllGroups"
          />
        </UTooltip>
        <QTableGroupLoadMore
          :has-more="root.hasMore && !root.error && !changingGroups"
          :loading="root.loading"
          @load="loadGroups"
        />
        <USwitch v-model="showMetrics" class="ms-auto" label="Show effort metrics" />
      </footer>
      <TasksTaskPagination v-else :table="table" :branch="root" :path="[]">
        <LoadingModeSwitch />
      </TasksTaskPagination>
    </div>
  </WorkboardPanel>
</template>

<script setup lang="ts">
import type { TableColumn, TableProps } from '@nuxt/ui';
import { andWhere, filteringToWhere, useGroupedTable, type GroupNode } from '@querry-kit/nuxt';
import type { ColumnDefinition, FilterField, Filtering, GroupingField, SortingField } from '@querry-kit/nuxt-ui/types';
import { createReusableTemplate, refDebounced, useInfiniteScroll } from '@vueuse/core';
import { resourceIdSchema, type DemoSession, type Task } from '@workboard/contracts';

import ProjectLookup from '~/components/tasks/ProjectLookup.vue';

import { taskTableUi, type GroupItemColumn } from '~/utils/group-table';
import { taskFilterFields, taskStaticWhere } from '~/utils/task-controls';

const props = defineProps<{ session: DemoSession }>();
const { $workboardApi } = useNuxtApp();
const route = useRoute();
const router = useRouter();
const search = ref('');
const showMetrics = ref(false);
const { selectedCount, isSelected, groupState, selectTasks, selectGroup, deletePayload, clearSelection } =
  useTaskSelection();
const deleteOpen = ref(false);
const debouncedSearch = refDebounced(search, 250);
const project = computed<string | undefined>({
  /** Reads the project from the current URL, including links from the project list. */
  get: () => {
    const parsed = resourceIdSchema.safeParse(route.query.project);
    return parsed.success ? parsed.data : undefined;
  },
  /** Replaces the filter while preserving the rest of the query. */
  set: (value: string | undefined) => {
    if (value !== project.value) void router.replace({ query: { ...route.query, project: value } });
  },
});
const projectFilterAdded = ref(false);
const projectFilterVisible = computed(
  /** Includes project links and locally added empty rows. */ () => projectFilterAdded.value || Boolean(project.value),
);
const filterFields = computed<FilterField[]>(
  /** Offers a single project filter alongside the standard filter fields. */
  () => [
    {
      value: 'project',
      label: 'Project',
      type: 'select',
      component: ProjectLookup,
      disabled: projectFilterVisible.value,
    },
    ...taskFilterFields,
  ],
);
const [DefineLoadingModeSwitch, LoadingModeSwitch] = createReusableTemplate();
const viewport = useTemplateRef('viewport');

const staticFilter = computed(
  /** Validates the search and relation filters using the same contract as the API. */
  () => taskStaticWhere(debouncedSearch.value, project.value),
);

/** Renders the title from the projected relation rather than passing the object to the renderer. */
function projectTitle(item: Task): string {
  return item.project?.title ?? '—';
}

/** Renders a public account name without exposing any additional account data. */
function ownerName(item: Task): string {
  return item.owner?.profile?.displayName ?? '—';
}

const allColumns: GroupItemColumn[] = [
  { id: 'title', accessorKey: 'title', header: 'Title', enableHiding: false },
  { id: 'status', accessorKey: 'status', header: 'Status' },
  { id: 'priority', accessorKey: 'priority', header: 'Priority' },
  { id: 'project', accessorFn: projectTitle, header: 'Project', fields: ['title'] },
  { id: 'owner', accessorFn: ownerName, header: 'Owner', fields: ['profile.displayName'] },
  { id: 'estimatedHours', accessorKey: 'estimatedHours', header: 'Est. hours' },
  { id: 'labels', accessorKey: 'labels', header: 'Labels', fields: ['id', 'displayName'] },
  { id: 'internalNote', accessorKey: 'internalNote', header: 'Internal note' },
  { id: 'internalCostCents', accessorKey: 'internalCostCents', header: 'Internal cost' },
  { id: 'actions', header: 'Actions', enableHiding: false },
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

const sortableFields = computed<SortingField[]>(
  /** Offers the same authorized data columns in the toolbar and preserves the creation-date sort. */
  () => [
    ...columnOptions.value.flatMap(
      /** Skips the action menu, which has no sortable value. */
      ({ id, header }) => (id === 'actions' ? [] : [{ value: id, label: header }]),
    ),
    { value: 'createdAt', label: 'Created at' },
  ],
);

const groupableFields: GroupingField[] = props.session.groupableFields.map(
  /** Uses the same label as the table header for each authorized grouping field. */
  (value) => ({
    value,
    label: columnOptions.value.find(/** Matches the grouping field ID. */ ({ id }) => id === value)?.header ?? value,
  }),
);

// The headless table owns projections, preferences, sorting, and server pagination.
// https://querry-kit.github.io/querry-kit/docs/nuxt/api/table/
// https://querry-kit.github.io/querry-kit/docs/nuxt-ui/components/toolbar/
const table = useGroupedTable<Task, GroupItemColumn>({
  api: $workboardApi,
  endpoint: 'tasks',
  columns: availableColumns,
  groupableFields,
  groupSumFields: ['estimatedHours'],
  persistExpansion: true,
  persistenceKey: `tasks:${props.session.id}`,
  staticFilter,
  defaultItemsPerPage: 2,
  loading: { initialMode: 'pagination', preloadGroupItems: false },
});
const {
  columns,
  root,
  groups,
  allGroupsExpanded,
  grouping,
  loadingMode,
  sorting,
  filtering,
  columnOrder,
  columnVisibility,
  columnPinning,
} = table;
const changingGroups = ref(false);
const bulkGroupLabel = computed(
  /** Names the action the footer button will perform. */
  () => (allGroupsExpanded.value ? 'Collapse all groups' : 'Expand all groups'),
);
const projectFilter: Filtering['filters'][number] = { id: 'project', field: 'project', type: 'select', value: [] };
const toolbarFiltering = computed<Filtering>({
  /** Displays the URL-backed project filter alongside stored table filters. */
  get: () => {
    const { operator, filters } = filtering.value as Filtering;
    return { operator, filters: projectFilterVisible.value ? [projectFilter, ...filters] : filters };
  },
  /** Removes the project query when its row is deleted, without changing how the remaining filters combine. */
  set: (value) => {
    projectFilterAdded.value = value.filters.some(
      /** Identifies the dedicated project row. */ (filter) => filter.field === 'project',
    );
    if (!projectFilterAdded.value) project.value = undefined;
    filtering.value = {
      operator: value.operator,
      filters: value.filters.filter(
        /** Keeps project scoping in the URL-backed filter. */ (filter) => filter.field !== 'project',
      ),
    };
  },
});
const groupFilter = computed(
  /** Shares the group query's search, project filter, and structured filters with effort metrics. */
  () => andWhere(staticFilter.value, filteringToWhere(filtering.value)),
);
const selectionScope = computed(
  /** Distinguishes filter and grouping changes from page changes. */
  () => JSON.stringify([groupFilter.value, grouping.value]),
);
watch(
  selectionScope,
  /** Prevents a stale selection from being confirmed against a different filter. */
  () => {
    deleteOpen.value = false;
    clearSelection();
  },
);

type DisplayRow =
  | { kind: 'task'; key: string; task: Task }
  | { kind: 'group'; key: string; node: GroupNode<Task> }
  | { kind: 'controls'; key: string; node: GroupNode<Task>; leaf: boolean };

/** Gives each task a stable key independent of the current sort, page, or parent group. */
function taskRow(task: Task): DisplayRow {
  return { kind: 'task', key: `task:${task.id}`, task };
}

/** Puts open groups, their records, and branch controls in a single row sequence. */
function appendGroup(rows: DisplayRow[], node: GroupNode<Task>): void {
  rows.push({ kind: 'group', key: `group:${node.key}`, node });
  if (!node.expanded) return;

  const leaf = node.path.length === grouping.value.length;
  if (leaf) rows.push(...node.items.map(taskRow));
  else for (const child of node.children) appendGroup(rows, child);

  if (leaf || node.hasMore || node.loading || node.error || showMetrics.value) {
    rows.push({ kind: 'controls', key: `controls:${node.key}`, node, leaf });
  }
}

const rows = computed<DisplayRow[]>(
  /** Renders the server tree without issuing requests for collapsed groups. */
  () => {
    if (!grouping.value.length) return root.items.map(taskRow);
    const visible: DisplayRow[] = [];
    for (const node of groups.value) appendGroup(visible, node);
    return visible;
  },
);
const visibleTasks = computed(
  /** Excludes group summaries, controls, and tasks outside the currently rendered rows. */
  () =>
    rows.value.flatMap(
      /** Keeps tasks with a stable ID. */ (row) => (row.kind === 'task' && row.task.id ? [row.task] : []),
    ),
);
const visibleSelection = computed(
  /** Reflects an empty, partial or complete selection of the visible task rows. */
  (): boolean | 'indeterminate' => {
    const count = visibleTasks.value.filter(/** Counts checked visible rows. */ isSelected).length;
    if (!count) return false;
    return count === visibleTasks.value.length ? true : 'indeterminate';
  },
);
const displayPinning = computed(
  /** Lets grouping columns precede left-pinned fields without freezing the group columns on small screens. */
  () =>
    grouping.value.length
      ? {
          left: ['selection'],
          right: (columnPinning.value.right ?? []).filter(
            /** Keeps only non-group columns pinned at the right edge. */
            (id) => !grouping.value.includes(id),
          ),
        }
      : { ...columnPinning.value, left: ['selection', ...(columnPinning.value.left ?? [])] },
);
const orderedColumns = computed(
  /** Keeps grouping columns visible and ordered by group depth, even if saved as hidden. */
  () => {
    const leading = [...grouping.value, ...(grouping.value.length ? (columnPinning.value.left ?? []) : [])];
    const ids = new Set([...leading, ...columns.value.map(/** Reads the visible column ID. */ ({ id }) => id)]);
    return [...ids].flatMap(
      /** Resolves only visible columns and the required grouping fields. */
      (id) => {
        const allowed = grouping.value.includes(id) ? availableColumns.value : columns.value;
        const column = allowed.find(/** Matches a declared column ID. */ (entry) => entry.id === id);
        return column ? [column] : [];
      },
    );
  },
);
const selectionWidth = 48;
const groupedColumnWidths: Record<string, number> = {
  title: 220,
  status: 168,
  priority: 132,
  project: 150,
  owner: 150,
  estimatedHours: 115,
  labels: 144,
  internalNote: 220,
  internalCostCents: 130,
  actions: 88,
};

/** Uses the standard relation width for any newly added columns. */
function groupedColumnWidth(id: string | undefined): number {
  return groupedColumnWidths[id ?? ''] ?? 150;
}

const groupedTableWidth = computed(
  /** Reserves the same scroll width before and after groups or pages are opened. */
  () =>
    orderedColumns.value.reduce(
      /** Adds each visible column's width. */ (total, { id }) => total + groupedColumnWidth(id),
      selectionWidth,
    ),
);
const flexibleColumn = computed(
  /** Gives surplus space to the title when possible, keeping pinned column offsets accurate. */
  () => (displayPinning.value.right?.includes('title') ? grouping.value[0] : 'title'),
);
const selectionColumn: TableColumn<DisplayRow> = {
  id: 'selection',
  header: 'Selection',
  size: selectionWidth,
  enableSorting: false,
  meta: {
    class: {
      th: 'first:pl-3 w-12 bg-default',
      /** Lets group controls span the table without inheriting sticky positioning. */
      td: ({ row }) => {
        if (row.original.kind === 'controls') return 'static! p-0 first:pl-0';
        return row.original.kind === 'group' ? 'first:pl-3 w-12 bg-inherit' : 'first:pl-3 w-12 bg-default';
      },
    },
    colspan: {
      /** Spans the selection cell and all visible resource columns on control rows. */
      td: ({ row }) => (row.original.kind === 'controls' ? String(orderedColumns.value.length + 1) : '1'),
    },
  },
};
const displayColumns = computed<(TableColumn<DisplayRow> & { id: string })[]>(
  /** Maps resource columns to the shared table renderer. */
  () =>
    orderedColumns.value.flatMap(
      /** Adds cell metadata for numeric alignment and full-width branch controls. */
      ({ id, header }) => {
        if (!id || typeof header !== 'string') return [];
        const align =
          id === 'estimatedHours' || id === 'internalCostCents' || id === 'actions' ? 'text-right tabular-nums' : '';
        const groupedWidth = grouping.value.length ? groupedColumnWidth(id) : undefined;
        const cellLayout = groupedWidth
          ? id === 'internalNote'
            ? 'whitespace-normal wrap-break-word'
            : 'truncate'
          : '';
        return [
          {
            id,
            header,
            size: groupedWidth,
            enableSorting: id !== 'actions',
            sortDescFirst: false,
            /** Enables TanStack's sorting controls while the API orders the rows. */
            accessorFn: (row) => (row.kind === 'task' ? row.task[id as keyof Task] : undefined),
            meta: {
              class: {
                th: align,
                /** Hides unused cells in a full-width control row. */
                td: ({ row }) => {
                  if (row.original.kind === 'controls') return 'hidden';
                  return row.original.kind === 'group' ? `${align} ${cellLayout} bg-inherit` : `${align} ${cellLayout}`;
                },
              },
              style: groupedWidth && id !== flexibleColumn.value ? { th: { width: `${groupedWidth}px` } } : undefined,
            },
          },
        ];
      },
    ),
);
const rowMeta: TableProps<DisplayRow>['meta'] = {
  class: {
    /** Distinguishes group rows from individual tasks. */
    tr: (row) => (row.original.kind === 'group' ? 'cursor-pointer bg-elevated hover:bg-accented' : ''),
  },
};

/** Supplies the resource or branch key to TanStack Table. */
function getRowId(row: DisplayRow): string {
  return row.key;
}

/** Makes the group value, count, and expansion state available to keyboard and screen reader users. */
function groupLabel(node: GroupNode<Task>): string {
  return `${node.value ?? 'No value'} ${node.count} items`;
}

/** Makes the entire group row activate the same disclosure button used by the keyboard. */
function toggleGroupRow(event: MouseEvent): void {
  const target = event.target;
  if (!(target instanceof Element) || target.closest('button, a, input, select, textarea')) return;
  target.closest('tbody tr')?.querySelector<HTMLButtonElement>('button[data-group-toggle]')?.click();
}

/** Displays the current server sort direction at the column header. */
function sortIcon(direction: false | 'asc' | 'desc'): string {
  if (direction === 'asc') return 'i-tabler-arrow-up';
  if (direction === 'desc') return 'i-tabler-arrow-down';
  return 'i-tabler-arrows-sort';
}

/** Reads plain projected values after relation and action cells have been handled. */
function taskValue(task: Task, id: string): string | number | boolean | undefined {
  const value = task[id as keyof Task];
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : undefined;
}

useInfiniteScroll(
  viewport,
  /** Appends flat rows near the end of the shared viewport. */ () => table.loadMoreItems([]),
  {
    distance: 48,
    /** Group leaves load through their own visible control rows. */
    canLoadMore: () =>
      loadingMode.value === 'infinite' && !grouping.value.length && root.hasMore && !root.loading && !root.error,
  },
);

/** Opens the created task even if it falls outside the current filters or page. */
function openCreatedTask(task: Task): void {
  if (task.id) void router.push({ path: `/tasks/${task.id}`, query: { project: project.value } });
}

/** Submits the confirmed selection as one atomic request. */
async function deleteSelected(): Promise<void> {
  await $workboardApi.post('/tasks/bulk-delete', deletePayload(groupFilter.value));
}

/** Reloads tasks and group totals after the confirmed deletion. */
function refreshAfterDelete(): void {
  clearSelection();
  void table.refresh();
  void nextTick(
    /** Returns keyboard focus to the table once the bulk action disappears. */ () => viewport.value?.focus(),
  );
}

/** Retries the failed batch while retaining already loaded rows or groups. */
function retry(): void {
  if (grouping.value.length) loadGroups();
  else if (loadingMode.value === 'infinite') void table.loadMoreItems([]);
  else {
    const { page, requestedPage } = table.getItemPage();
    void table.loadItemsPage([], requestedPage ?? page);
  }
}

/** Appends the next batch of top-level groups. */
function loadGroups(): void {
  void table.loadMoreGroups();
}

/** Expands or collapses the current group tree through the headless table. */
async function toggleAllGroups(): Promise<void> {
  changingGroups.value = true;
  try {
    await table.setAllGroupsExpanded(!allGroupsExpanded.value);
  } finally {
    changingGroups.value = false;
  }
}

onMounted(table.initialize);
</script>
