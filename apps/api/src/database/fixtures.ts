import type { Prisma } from '../generated/prisma/client.js';

/** Seed input ordered by dependency rather than by screen or controller. */
export interface WorkboardFixtures {
  accounts: Prisma.AccountCreateManyInput[];
  profiles: Prisma.ProfileCreateManyInput[];
  projects: Prisma.ProjectCreateManyInput[];
  items: Prisma.WorkItemCreateManyInput[];
  labels: Prisma.LabelCreateManyInput[];
  itemLabels: Prisma.WorkItemLabelCreateManyInput[];
}

const SAMPLE_DATE = new Date('2026-11-01T09:00:00.000Z');

/** Declares one fixture row with shared dates and deterministic internal values. */
function item(
  id: string,
  ownerId: string,
  projectId: string,
  title: string,
  status: Prisma.WorkItemCreateManyInput['status'],
  priority: Prisma.WorkItemCreateManyInput['priority'],
  estimatedHours: number,
  assigneeId: string | null = ownerId,
): Prisma.WorkItemCreateManyInput {
  return {
    id,
    ownerId,
    projectId,
    assigneeId,
    title,
    status,
    priority,
    estimatedHours,
    internalNote: `Demo planning note for ${id}.`,
    internalCostCents: id === 'a6' ? 98_765 : estimatedHours * 4_000,
    createdAt: SAMPLE_DATE,
  };
}

/** Stable synthetic rows used by the demo and its read-policy checks. */
export const demoFixtures: WorkboardFixtures = {
  accounts: [
    { id: 'u1', login: 'user1', role: 'user' },
    { id: 'u2', login: 'user2', role: 'user' },
    { id: 'admin', login: 'admin', role: 'admin' },
  ],
  profiles: [
    { accountId: 'u1', displayName: 'Avery Lane' },
    { accountId: 'u2', displayName: 'Blair Chen' },
    { accountId: 'admin', displayName: 'Robin Patel' },
  ],
  projects: [
    { id: 'shared', slug: 'workboard', title: 'Workboard' },
    { id: 'design', slug: 'design', title: 'Design' },
    { id: 'docs', slug: 'documentation', title: 'Documentation' },
    { id: 'ops', slug: 'operations', title: 'Operations' },
  ],
  items: [
    item('u1-1', 'u1', 'shared', 'Review navigation labels', 'OPEN', 'HIGH', 2, null),
    item('u1-2', 'u1', 'design', 'Sketch an empty state', 'OPEN', 'NORMAL', 6),
    item('u1-3', 'u1', 'shared', 'Clarify board filters', 'IN_PROGRESS', 'NORMAL', 4),
    item('u1-4', 'u1', 'design', 'Check colour contrast', 'IN_PROGRESS', 'HIGH', 4),
    item('u1-5', 'u1', 'shared', 'Measure card spacing', 'DONE', 'LOW', 1),
    item('u1-6', 'u1', 'design', 'Review detail layout', 'DONE', 'LOW', 2),
    item('u2-1', 'u2', 'shared', 'Review navigation labels', 'OPEN', 'NORMAL', 3),
    item('u2-2', 'u2', 'docs', 'Draft filter reference', 'OPEN', 'HIGH', 9, null),
    item('u2-3', 'u2', 'shared', 'Review keyboard examples', 'IN_PROGRESS', 'NORMAL', 4),
    item('u2-4', 'u2', 'docs', 'Check code snippets', 'IN_PROGRESS', 'HIGH', 4),
    item('u2-5', 'u2', 'shared', 'Verify tooltips', 'DONE', 'LOW', 1),
    item('u2-6', 'u2', 'docs', 'Publish glossary draft', 'DONE', 'LOW', 2),
    item('a1', 'admin', 'shared', 'Audit default projections', 'OPEN', 'HIGH', 10),
    item('a2', 'admin', 'ops', 'Review deployment notes', 'IN_PROGRESS', 'NORMAL', 7),
    item('a3', 'admin', 'ops', 'Check startup metrics', 'IN_PROGRESS', 'HIGH', 5),
    item('a4', 'admin', 'shared', 'Record review decisions', 'DONE', 'LOW', 4),
    item('a5', 'admin', 'ops', 'Verify backup checks', 'DONE', 'NORMAL', 3),
    item('a6', 'admin', 'ops', 'Retire old demo fixtures', 'ARCHIVED', 'LOW', 1),
  ],
  labels: [
    { id: 'review', slug: 'review', displayName: 'Review' },
    { id: 'ux', slug: 'ux', displayName: 'UX' },
    { id: 'guide', slug: 'guide', displayName: 'Guide' },
    { id: 'ops', slug: 'ops', displayName: 'Operations' },
  ],
  itemLabels: [
    { workItemId: 'u1-1', labelId: 'review' },
    { workItemId: 'u1-1', labelId: 'ux' },
    { workItemId: 'u1-4', labelId: 'ux' },
    { workItemId: 'u2-1', labelId: 'review' },
    { workItemId: 'u2-2', labelId: 'guide' },
    { workItemId: 'u2-4', labelId: 'guide' },
    { workItemId: 'a1', labelId: 'review' },
    { workItemId: 'a6', labelId: 'ops' },
  ],
};
