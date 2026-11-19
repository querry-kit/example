import { z } from 'zod';

import {
  idFilterSchema,
  orderDirectionSchema,
  paginatedSchema,
  resourceIdSchema,
  textFilterSchema,
  wireIntegerSchema,
} from './query.js';

/** Public seeded work-item states. */
export const workItemStatusSchema = z.enum(['OPEN', 'IN_PROGRESS', 'DONE', 'ARCHIVED']);
/** Public seeded scheduling priorities. */
export const workItemPrioritySchema = z.enum(['LOW', 'NORMAL', 'HIGH']);

const numeric = wireIntegerSchema.pipe(z.number().int().min(0).max(2_147_483_647));
const numericFilter = z.union([
  numeric,
  z.strictObject({
    equals: numeric.optional(),
    not: numeric.optional(),
    gt: numeric.optional(),
    gte: numeric.optional(),
    lt: numeric.optional(),
    lte: numeric.optional(),
  }),
]);
const statusFilter = z.union([
  workItemStatusSchema,
  z.strictObject({
    equals: workItemStatusSchema.optional(),
    in: z.array(workItemStatusSchema).max(4).optional(),
    notIn: z.array(workItemStatusSchema).max(4).optional(),
  }),
]);
const priorityFilter = z.union([
  workItemPrioritySchema,
  z.strictObject({
    equals: workItemPrioritySchema.optional(),
    in: z.array(workItemPrioritySchema).max(3).optional(),
    notIn: z.array(workItemPrioritySchema).max(3).optional(),
  }),
]);

const simpleWhere = z.strictObject({
  id: idFilterSchema.optional(),
  title: textFilterSchema.optional(),
  status: statusFilter.optional(),
  priority: priorityFilter.optional(),
  estimatedHours: numericFilter.optional(),
  internalNote: textFilterSchema.optional(),
  internalCostCents: numericFilter.optional(),
  project: z.strictObject({ id: idFilterSchema.optional(), title: textFilterSchema.optional() }).optional(),
  labels: z.strictObject({ some: z.strictObject({ labelId: idFilterSchema }) }).optional(),
});

/** Allows one more nested layer of bounded boolean predicates. */
function withBooleanConditions<T extends z.ZodType>(child: T) {
  return simpleWhere.extend({
    AND: z.array(child).min(1).max(12).optional(),
    OR: z.array(child).min(1).max(12).optional(),
  });
}

/** Supported query predicates. Includes room for both UI filters and the current group path. */
export const workItemWhereSchema = withBooleanConditions(withBooleanConditions(withBooleanConditions(simpleWhere)));

const orderRule = z.strictObject({
  id: orderDirectionSchema.optional(),
  title: orderDirectionSchema.optional(),
  status: orderDirectionSchema.optional(),
  priority: orderDirectionSchema.optional(),
  estimatedHours: orderDirectionSchema.optional(),
  createdAt: orderDirectionSchema.optional(),
  internalNote: orderDirectionSchema.optional(),
  internalCostCents: orderDirectionSchema.optional(),
});

/** Shared response selector; Querry Kit parses the nested `fields` grammar. */
export const workItemDetailQuerySchema = z.strictObject({ fields: z.string().trim().min(1).max(500).optional() });

/** Query parameters after bracket syntax and JSON `where` are normalized. */
export const workItemListQuerySchema = workItemDetailQuerySchema.extend({
  where: workItemWhereSchema.optional(),
  orderBy: z.union([orderRule, z.array(orderRule).max(8)]).optional(),
  page: wireIntegerSchema.pipe(z.number().int().min(1).max(10_000)).default(1),
  perPage: wireIntegerSchema.pipe(z.number().int().min(1).max(100)).default(10),
});

/** A count takes exactly the same filter as the record list. */
export const workItemCountQuerySchema = z.strictObject({ where: workItemWhereSchema.optional() });

const personProjection = z.strictObject({
  id: resourceIdSchema.optional(),
  profile: z.strictObject({ displayName: z.string().optional() }).nullable().optional(),
});
const projectProjection = z.strictObject({
  id: resourceIdSchema.optional(),
  slug: z.string().optional(),
  title: z.string().optional(),
});
const labelProjection = z.strictObject({
  id: resourceIdSchema.optional(),
  slug: z.string().optional(),
  displayName: z.string().optional(),
});

/** Omitted fields were not projected; a nullable relation may explicitly be null. */
export const workItemSchema = z.strictObject({
  id: resourceIdSchema.optional(),
  title: z.string().optional(),
  status: workItemStatusSchema.optional(),
  priority: workItemPrioritySchema.optional(),
  estimatedHours: z.number().int().nonnegative().optional(),
  createdAt: z.iso.datetime().optional(),
  project: projectProjection.optional(),
  owner: personProjection.optional(),
  assignee: personProjection.nullable().optional(),
  labels: z.array(labelProjection).optional(),
  internalNote: z.string().optional(),
  internalCostCents: z.number().int().nonnegative().optional(),
});

/** Response type from the supported projection and pagination paths. */
export const workItemPageSchema = paginatedSchema(workItemSchema);
/** Validated list input forwarded to the Querry Kit read service. */
export type WorkItemListQuery = z.infer<typeof workItemListQuerySchema>;
/** Validated filter accepted by list/count/group routes. */
export type WorkItemWhere = z.infer<typeof workItemWhereSchema>;
/** Work item payload whose keys follow the requested projection. */
export type WorkItem = z.infer<typeof workItemSchema>;
