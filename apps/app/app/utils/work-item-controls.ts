import { andWhere } from '@querry-kit/nuxt';
import type { FilterField, SortingField } from '@querry-kit/nuxt-ui/types';
import { workItemPrioritySchema, workItemStatusSchema, workItemWhereSchema } from '@workboard/contracts';

export const workItemSortableFields: SortingField[] = [
  { value: 'title', label: 'Title' },
  { value: 'status', label: 'Status' },
  { value: 'priority', label: 'Priority' },
  { value: 'estimatedHours', label: 'Est. hours' },
  { value: 'createdAt', label: 'Created at' },
];

export const workItemFilterFields: FilterField[] = [
  {
    value: 'status',
    label: 'Status',
    type: 'enum',
    values: workItemStatusSchema.options.map(/** Labels a status option. */ (value) => ({ value, label: value })),
  },
  {
    value: 'priority',
    label: 'Priority',
    type: 'enum',
    values: workItemPrioritySchema.options.map(/** Labels a priority option. */ (value) => ({ value, label: value })),
  },
  { value: 'estimatedHours', label: 'Est. hours', type: 'number' },
];

/** Applies the same validated search and optional project relation filter in both views. */
export function workItemStaticWhere(search: string | undefined, project?: string) {
  const title = search?.trim().slice(0, 160);
  const where = andWhere(
    title ? { title: { contains: title, mode: 'insensitive' } } : undefined,
    project ? { project: { id: project } } : undefined,
  );
  return where ? workItemWhereSchema.parse(where) : undefined;
}
