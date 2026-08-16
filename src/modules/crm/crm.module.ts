import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CrmLead } from './entities/crm-lead.entity';
import { CrmNote } from './entities/crm-note.entity';
import { CrmTag } from './entities/crm-tag.entity';
import { CrmLeadTag } from './entities/crm-lead-tag.entity';
import { CrmFollowup } from './entities/crm-followup.entity';
import { CrmActivity } from './entities/crm-activity.entity';
import { MessageBatch } from '../message/entities/message-batch.entity';
import { User } from '../user/entities/user.entity';
import { Organization } from '../organization/entities/organization.entity';
import { OrganizationMember } from '../organization/entities/organization-member.entity';
import { PlanModule } from '../plan/plan.module';
import { CrmService } from './crm.service';
import { CrmController } from './crm.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature(
      [CrmLead, CrmNote, CrmTag, CrmLeadTag, CrmFollowup, CrmActivity, MessageBatch],
      'data',
    ),
    TypeOrmModule.forFeature([User, Organization, OrganizationMember], 'main'),
    PlanModule,
  ],
  controllers: [CrmController],
  providers: [CrmService],
  exports: [CrmService],
})
export class CrmModule {}
