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

    <QTableGrouped
      ref="groupedView"
      label="Tasks table"
      flexible-column="title"
      :table="table"
      :columns="columns"
      :available-columns="availableColumns"
      :get-id="(item) => item.id ?? ''"
      :show-branch="showMetrics"
      :ui="taskTableUi"
      :texts="{ grouping: { empty: 'No matching tasks', itemsError: 'Could not load tasks' } }"
    >
      <template #leading-header="{ items }">
        <UCheckbox
          aria-label="Select visible tasks"
          :model-value="visibleSelection(items)"
          :disabled="!items.some((item) => item.id)"
          @update:model-value="selectTasks(items, $event === true)"
        />
      </template>
      <template #leading="{ item, node }">
        <UCheckbox
          v-if="node"
          :aria-label="`Select group ${node.value ?? 'No value'} ${node.count} items`"
          :model-value="groupState(node)"
          @update:model-value="selectGroup(node, $event === true)"
        />
        <UCheckbox
          v-else-if="item?.id"
          :aria-label="`Select ${item.title ?? item.id}`"
          :model-value="isSelected(item)"
          @update:model-value="selectTasks([item], $event === true)"
        />
      </template>
      <template #group-value="{ node }">
        <TasksTaskValue :field="node.field" :value="node.value" />
      </template>
      <template #group-cell="{ node, field }">
        <span v-if="field === 'estimatedHours'" aria-label="Total estimated hours" class="font-medium text-highlighted">
          {{ node.sum?.estimatedHours ?? '—' }}
        </span>
      </template>
      <template #cell="{ field, item }">
        <ULink
          v-if="field === 'title' && item.id"
          class="font-medium text-highlighted hover:text-primary"
          :to="{ path: `/tasks/${item.id}`, query: { project } }"
          :aria-label="`Open ${item.title ?? item.id}`"
        >
          {{ item.title }}
        </ULink>
        <UBadge
          v-else-if="field === 'project' && item.project?.title"
          class="rounded-full"
          color="primary"
          variant="subtle"
          icon="i-tabler-folder"
          :label="item.project.title"
        />
        <UBadge
          v-else-if="field === 'owner' && item.owner?.profile?.displayName"
          class="rounded-full"
          color="neutral"
          variant="subtle"
          icon="i-tabler-user"
          :label="item.owner.profile.displayName"
        />
        <template v-else-if="field === 'labels'">
          <ul v-if="item.labels?.length" class="flex max-w-64 flex-wrap gap-1" aria-label="Labels">
            <li v-for="label in item.labels" :key="label.id">
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
          v-else-if="field === 'actions' && item.id"
          :items="[
            {
              label: 'Open',
              icon: 'i-tabler-external-link',
              to: { path: `/tasks/${item.id}`, query: { project } },
            },
          ]"
        >
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-tabler-dots-vertical"
            :aria-label="`Actions for ${item.title ?? item.id}`"
          />
        </UDropdownMenu>
        <TasksTaskValue v-else :field="field" :value="taskValue(item, field)" />
      </template>
      <template v-if="showMetrics" #branch="{ node }">
        <TasksGroupMetrics :path="node.path" :filter="groupFilter" />
      </template>
      <template #footer-start>
        <LoadingModeSwitch />
      </template>
      <template #footer-end>
        <USwitch v-model="showMetrics" class="ms-auto" label="Show effort metrics" />
      </template>
    </QTableGrouped>
  </WorkboardPanel>
</template>

<script setup lang="ts">
import { andWhere, filteringToWhere, useGroupedTable } from '@querry-kit/nuxt';
import type {
  ColumnDefinition,
  FilterField,
  Filtering,
  GroupedTableColumn,
  GroupingField,
  SortingField,
} from '@querry-kit/nuxt-ui/types';
import { createReusableTemplate, refDebounced } from '@vueuse/core';
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
const groupedView = useTemplateRef<{ focus: () => void }>('groupedView');

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

type TaskColumn = GroupItemColumn & GroupedTableColumn;
const allColumns: TaskColumn[] = [
  { id: 'title', width: 220, accessorKey: 'title', header: 'Title', enableHiding: false },
  { id: 'status', width: 168, accessorKey: 'status', header: 'Status' },
  { id: 'priority', width: 132, accessorKey: 'priority', header: 'Priority' },
  { id: 'project', width: 150, accessorFn: projectTitle, header: 'Project', fields: ['title'] },
  { id: 'owner', width: 150, accessorFn: ownerName, header: 'Owner', fields: ['profile.displayName'] },
  { id: 'estimatedHours', width: 115, align: 'right', accessorKey: 'estimatedHours', header: 'Est. hours' },
  { id: 'labels', width: 144, accessorKey: 'labels', header: 'Labels', fields: ['id', 'displayName'] },
  {
    id: 'internalNote',
    width: 220,
    groupedCellClass: 'whitespace-normal wrap-break-word',
    accessorKey: 'internalNote',
    header: 'Internal note',
  },
  { id: 'internalCostCents', width: 130, align: 'right', accessorKey: 'internalCostCents', header: 'Internal cost' },
  { id: 'actions', width: 88, align: 'right', sortable: false, header: 'Actions', enableHiding: false },
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
const table = useGroupedTable<Task, TaskColumn>({
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
const { columns, grouping, loadingMode, sorting, filtering, columnOrder, columnVisibility, columnPinning } = table;
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

/** Reflects an empty, partial or complete selection of the visible task rows. */
function visibleSelection(items: readonly Task[]): boolean | 'indeterminate' {
  const selectable = items.filter(/** Selects only records with an ID. */ (item) => item.id);
  const count = selectable.filter(isSelected).length;
  return count > 0 && (count === selectable.length ? true : 'indeterminate');
}

/** Reads plain projected values after relation and action cells have been handled. */
function taskValue(task: Task, id: string): string | number | boolean | undefined {
  const value = task[id as keyof Task];
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : undefined;
}

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
    /** Returns keyboard focus to the table once the bulk action disappears. */ () => groupedView.value?.focus(),
  );
}

onMounted(table.initialize);
</script>
