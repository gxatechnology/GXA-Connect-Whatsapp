import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from './entities/organization.entity';
import { OrganizationMember } from './entities/organization-member.entity';
import { OrganizationUsage } from './entities/organization-usage.entity';
import { User } from '../user/entities/user.entity';
import { OrganizationService } from './organization.service';
import { OrganizationController } from './organization.controller';
import { PlatformController } from './platform.controller';
import { ResellerController } from './reseller.controller';
import { PlanModule } from '../plan/plan.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Organization, OrganizationMember, OrganizationUsage, User], 'main'),
    PlanModule,
    AuditModule,
  ],
  controllers: [
    OrganizationController,
    PlatformController,
    ResellerController,
  ],
  providers: [OrganizationService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
