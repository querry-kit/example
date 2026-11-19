import { AbilityBuilder, type Ability, type ForcedSubject } from '@casl/ability';
import { createPrismaAbility, type PrismaQueryOf } from '@casl/prisma/runtime';
import { workItemFieldSchema, type DemoSession, type WorkItemField } from '@workboard/contracts';

import type { Label, Prisma, Project, WorkItem } from '../generated/prisma/client.js';

/** Model names with a public Workboard read surface. */
export type WorkboardSubject = 'WorkItem' | 'Project' | 'Label';

type WorkboardRecord =
  (WorkItem & ForcedSubject<'WorkItem'>) | (Project & ForcedSubject<'Project'>) | (Label & ForcedSubject<'Label'>);

/** CASL conditions use the application's generated Prisma model types. */
export type WorkboardAbility = Ability<['read', WorkboardSubject | WorkboardRecord], PrismaQueryOf<Prisma.TypeMap>>;

/** Fields regular accounts may project or use in a query. */
const publicWorkItemFields: WorkItemField[] = [
  'id',
  'title',
  'status',
  'priority',
  'estimatedHours',
  'createdAt',
  'project',
  'owner',
  'assignee',
  'labels',
];

/**
 * Defines owner-scoped reads separately from field visibility.
 *
 * The two users share the same role. Only the server-resolved account ID determines which rows they own.
 *
 * @see https://querry-kit.github.io/querry-kit/docs/nest/api/casl/
 */
export function createWorkboardAbility(account: Pick<DemoSession, 'id' | 'role'>): WorkboardAbility {
  const { can, build } = new AbilityBuilder<WorkboardAbility>(createPrismaAbility);
  if (account.role === 'admin') {
    can('read', ['WorkItem', 'Project', 'Label']);
  } else {
    const ownedItem = { ownerId: account.id };
    can('read', 'WorkItem', publicWorkItemFields, ownedItem);
    can('read', 'Project', { workItems: { some: ownedItem } });
    can('read', 'Label', { workItems: { some: { workItem: { is: ownedItem } } } });
  }

  return build();
}

/** Derives client hints from the policy instead of maintaining a second role table. */
export function workboardCapabilities(ability: WorkboardAbility): Pick<DemoSession, 'fields' | 'groupableFields'> {
  const fields = workItemFieldSchema.options.filter(
    /** Selects a field if this ability can read it on any accessible work item. */
    (field) => ability.can('read', 'WorkItem', field),
  );

  return {
    fields,
    groupableFields: fields.includes('internalCostCents')
      ? ['status', 'priority', 'internalCostCents']
      : ['status', 'priority'],
  };
}
