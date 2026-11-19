import { BadRequestException, Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiNotFoundResponse, ApiTags } from '@nestjs/swagger';
import {
  resourceIdSchema,
  workItemCountQuerySchema,
  workItemDetailQuerySchema,
  workItemListQuerySchema,
  workItemPageSchema,
  workItemSchema,
  z,
} from '@workboard/contracts';

import { createWorkboardAbility } from '../auth/workboard-ability.js';
import { type AuthenticatedRequest, DemoSessionGuard } from '../demo/demo-session.guard.js';
import { describeRead } from '../query/query-docs.js';
import { readQuery } from '../query/query-parser.js';
import { WorkItemsService } from './work-items.service.js';

/** Read-only public contract for the Workboard resource. */
@ApiTags('Work items')
@ApiCookieAuth('workboard_demo')
@UseGuards(DemoSessionGuard)
@Controller('work-items')
export class WorkItemsController {
  /** Receives the validated, scoped service boundary. */
  constructor(private readonly workItems: WorkItemsService) {}

  /** Lists scope-aware paginated records in the Nuxt client's response format. */
  @Get()
  @describeRead(workItemListQuerySchema, workItemPageSchema)
  list(@Req() request: AuthenticatedRequest) {
    const query = readQuery(request, workItemListQuerySchema);
    return this.workItems.list(query, createWorkboardAbility(request.demoSession));
  }

  /** Counts the same accessible matches as the list. */
  @Get('count')
  @describeRead(workItemCountQuerySchema, z.number().int().nonnegative())
  count(@Req() request: AuthenticatedRequest) {
    const query = readQuery(request, workItemCountQuerySchema);
    return this.workItems.count(query.where, createWorkboardAbility(request.demoSession));
  }

  /** Delivers the public detail URL with identical missing and inaccessible results. */
  @Get(':id')
  @describeRead(workItemDetailQuerySchema, workItemSchema)
  @ApiNotFoundResponse({ description: 'Item not found or outside the active account scope.' })
  detail(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.readDetail(id, request);
  }

  /** Shares detail logic with the route expected by `useModuleApi().findById()`. */
  @Get('find-by-id/:id')
  @describeRead(workItemDetailQuerySchema, workItemSchema)
  @ApiNotFoundResponse({ description: 'Item not found or outside the active account scope.' })
  findById(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.readDetail(id, request);
  }

  /** Validates the ID and forwards both route shapes through one policy boundary. */
  private readDetail(id: string, request: AuthenticatedRequest) {
    if (!resourceIdSchema.safeParse(id).success) throw new BadRequestException('Invalid work item ID.');
    const query = readQuery(request, workItemDetailQuerySchema);
    return this.workItems.detail(id, query, createWorkboardAbility(request.demoSession));
  }
}
