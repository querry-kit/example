import type { TableColumn } from '@nuxt/ui';
import type { TableColumnInput, useGroupedTable } from '@querry-kit/nuxt';
import type { WorkItem } from '@workboard/contracts';

/** Column definitions shared by the headless table and its leaf renderer. */
export type GroupItemColumn = TableColumnInput<WorkItem, TableColumn<WorkItem>>;
/** Query Kit owns the group tree and each leaf's pagination. */
export type WorkItemGroupTable = ReturnType<typeof useGroupedTable<WorkItem, GroupItemColumn>>;
