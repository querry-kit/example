<template>
  <QTableGroup
    :label="String(node.value ?? 'No value')"
    :count="node.count"
    :expanded="node.expanded"
    :loading="node.loading"
    :error="node.error"
    @toggle="toggle"
    @retry="load"
  >
    <WorkItemsGroupMetrics v-if="showMetrics && !node.error" :path="node.path" :filter="filter" />
    <template v-if="!node.error">
      <WorkItemsGroupRows v-if="isLeaf" :table="table" :path="node.path" :branch="node" />
      <template v-else>
        <GroupBranch
          v-for="child in node.children"
          :key="child.key"
          :table="table"
          :node="child"
          :show-metrics="showMetrics"
          :filter="filter"
        />
        <QTableGroupLoadMore :has-more="node.hasMore" :loading="node.loading" @load="load" />
      </template>
    </template>
  </QTableGroup>
</template>

<script setup lang="ts">
import type { GroupNode } from '@querry-kit/nuxt';
import type { WorkItem } from '@workboard/contracts';
import type { WorkItemGroupTable } from '~/utils/group-table';

const props = defineProps<{
  table: WorkItemGroupTable;
  node: GroupNode<WorkItem>;
  filter?: Record<string, unknown>;
  showMetrics: boolean;
}>();
const isLeaf = computed(
  /** A complete group path contains records instead of more group headers. */
  () => props.node.path.length === props.table.grouping.value.length,
);

/** Expands this branch without touching its siblings. */
function toggle(): void {
  void props.table.toggleGroup(props.node.path);
}

/** Retries or advances the correct resource for this branch. */
function load(): void {
  if (!isLeaf.value) void props.table.loadMoreGroups(props.node.path);
  else if (props.table.loadingMode.value === 'infinite') void props.table.loadMoreItems(props.node.path);
  else void props.table.loadItemsPage(props.node.path, props.table.getItemPage(props.node.path).page);
}
</script>
