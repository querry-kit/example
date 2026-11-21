import { andWhere } from '@querry-kit/nuxt';
import type { FilterField } from '@querry-kit/nuxt-ui/types';
import { taskPrioritySchema, taskStatusSchema, taskWhereSchema } from '@workboard/contracts';

export const taskFilterFields: FilterField[] = [
  {
    value: 'status',
    label: 'Status',
    type: 'enum',
    values: taskStatusSchema.options.map(/** Labels a status option. */ (value) => ({ value, label: value })),
  },
  {
    value: 'priority',
    label: 'Priority',
    type: 'enum',
    values: taskPrioritySchema.options.map(/** Labels a priority option. */ (value) => ({ value, label: value })),
  },
  { value: 'estimatedHours', label: 'Est. hours', type: 'number' },
];

/** Applies the same validated search and optional project relation filter in both views. */
export function taskStaticWhere(search: string | undefined, project?: string) {
  const title = search?.trim().slice(0, 160);
  const where = andWhere(
    title ? { title: { contains: title, mode: 'insensitive' } } : undefined,
    project ? { project: { id: project } } : undefined,
  );
  return where ? taskWhereSchema.parse(where) : undefined;
}
