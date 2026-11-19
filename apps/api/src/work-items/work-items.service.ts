import { ForbiddenException, Injectable } from '@nestjs/common';
import { ResourceQuery } from '@querry-kit/nest/core';
import { workItemPageSchema, workItemSchema, type WorkItemListQuery, type WorkItemWhere } from '@workboard/contracts';

import { type WorkboardAbility } from '../auth/workboard-ability.js';
import { DatabaseService } from '../database/database.service.js';
import { createScopedQuery } from '../query/scoped-query.js';
import {
  checkProjection,
  projectWorkItem,
  workItemFields,
  workItemInclude,
  type WorkItemRecord,
} from './work-item-projection.js';

/** Verifies query operands as well as projected fields, preventing indirect disclosure. */
export function checkWorkItemWhere(where: WorkItemWhere | undefined, ability: WorkboardAbility): void {
  if (!where) return;

  for (const [field, value] of Object.entries(where)) {
    if (field === 'AND' || field === 'OR') {
      for (const child of value as WorkItemWhere[]) checkWorkItemWhere(child, ability);
    } else if (!ability.can('read', 'WorkItem', field)) {
      throw new ForbiddenException(`Cannot filter by ${field}.`);
    }
  }
}

/** Coordinates the permitted read paths without exposing arbitrary delegate inputs. */
@Injectable()
export class WorkItemsService {
  /** Initializes the Query Kit service with the actual Prisma delegate and read scope. */
  constructor(private readonly database: DatabaseService) {}

  /**
   * Lists scoped work items with a stable ID tie-breaker and shared output validation.
   *
   * @see https://querry-kit.github.io/querry-kit/docs/nest/api/query-service/
   * @see https://querry-kit.github.io/querry-kit/docs/nest/concepts/fields/
   */
  async list(query: WorkItemListQuery, ability: WorkboardAbility) {
    checkProjection(query.fields, ability);
    checkWorkItemWhere(query.where, ability);
    const orderBy = Array.isArray(query.orderBy) ? [...query.orderBy] : query.orderBy ? [query.orderBy] : [];
    let sortedById = false;
    for (const order of orderBy) {
      for (const field of Object.keys(order)) {
        if (!ability.can('read', 'WorkItem', field)) throw new ForbiddenException(`Cannot sort by ${field}.`);
        if (field === 'id') sortedById = true;
      }
    }
    if (!sortedById) orderBy.push({ id: 'asc' });

    const result = await ResourceQuery.query({
      service: createScopedQuery(this.database.workItem, 'WorkItem'),
      ability,
      query: { ...query, orderBy },
      schema: workItemFields,
      include: workItemInclude,
      /** Maps scoped rows before Query Kit applies the selected fields. */
      map: (row: WorkItemRecord) => projectWorkItem(row, ability),
    });
    return workItemPageSchema.parse(result);
  }

  /** Uses the same projection and row scope for both public detail routes. */
  async detail(id: string, query: { fields?: string }, ability: WorkboardAbility) {
    checkProjection(query.fields, ability);
    const result = await ResourceQuery.findById({
      service: createScopedQuery(this.database.workItem, 'WorkItem'),
      ability,
      id,
      query,
      schema: workItemFields,
      include: workItemInclude,
      /** Selects permitted fields on the scoped record before projection. */
      map: (row: WorkItemRecord) => projectWorkItem(row, ability),
    });
    return workItemSchema.parse(result);
  }

  /** Returns a JSON integer matching the typed Nuxt count client. */
  async count(where: WorkItemWhere | undefined, ability: WorkboardAbility): Promise<number> {
    checkWorkItemWhere(where, ability);
    return createScopedQuery(this.database.workItem, 'WorkItem').count({ where }, ability);
  }
}
