import { Module } from '@nestjs/common';

import { DatabaseModule } from '../database/database.module.js';
import { DemoModule } from '../demo/demo.module.js';
import { LookupsController } from '../lookups/lookups.controller.js';
import { WorkItemGroupsController } from './work-item-groups.controller.js';
import { WorkItemsController } from './work-items.controller.js';
import { WorkItemsService } from './work-items.service.js';

/** Wires authenticated read routes without registering any domain writes. */
@Module({
  imports: [DatabaseModule, DemoModule],
  controllers: [WorkItemsController, WorkItemGroupsController, LookupsController],
  providers: [WorkItemsService],
})
export class WorkboardReadsModule {}
