import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Req,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Request } from 'express';
import { OrganizationService } from './organization.service';
import { PlanService } from '../plan/plan.service';
import { CreateOrganizationDto, UpdateOrganizationDto } from './dto/organization.dto';
import { OrganizationType } from './entities/organization.entity';
import { RequireRole } from '../auth/decorators/auth.decorators';
import { ApiKeyRole } from '../auth/entities/api-key.entity';
import { User, PlatformRole } from '../user/entities/user.entity';

@ApiTags('reseller')
@Controller('reseller')
export class ResellerController {
  constructor(
    private readonly orgService: OrganizationService,
    private readonly planService: PlanService,
  ) {}

  private verifyReseller(req: Request): { user: User; resellerOrgId: string } {
    const user = (req as Request & { user?: User }).user;
    if (!user) throw new UnauthorizedException('Authentication required');
    if (user.platformRole !== PlatformRole.RESELLER_ADMIN && user.platformRole !== PlatformRole.SUPER_ADMIN) {
      throw new ForbiddenException('Access restricted to Reseller Administrators');
    }
    const resellerOrgId = user.activeOrganizationId;
    if (!resellerOrgId) {
      throw new ForbiddenException('No active reseller organization selected');
    }
    return { user, resellerOrgId };
  }

  @Get('overview')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Reseller dashboard summary statistics' })
  async getOverview(@Req() req: Request) {
    const { resellerOrgId } = this.verifyReseller(req);
    return this.orgService.getResellerOverview(resellerOrgId);
  }

  @Get('clients')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'List child client organizations under this reseller' })
  async getClients(@Req() req: Request) {
    const { resellerOrgId } = this.verifyReseller(req);
    return this.orgService.listOrganizations(OrganizationType.CLIENT, resellerOrgId);
  }

  @Post('clients')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Create a new child client organization under this reseller' })
  async createClient(@Body() dto: CreateOrganizationDto, @Req() req: Request) {
    const { user, resellerOrgId } = this.verifyReseller(req);
    return this.orgService.createOrganization(
      { ...dto, type: OrganizationType.CLIENT, parentOrganizationId: resellerOrgId },
      {
        id: user.id,
        platformRole: user.platformRole,
        organizationId: resellerOrgId,
        name: user.fullName,
      },
    );
  }

  @Patch('clients/:id')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Update a child client organization' })
  async updateClient(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
    @Req() req: Request,
  ) {
    const { user, resellerOrgId } = this.verifyReseller(req);
    const client = await this.orgService.findById(id);
    if (client.parentOrganizationId !== resellerOrgId && user.platformRole !== PlatformRole.SUPER_ADMIN) {
      throw new ForbiddenException('You can only modify child client organizations belonging to your reseller');
    }

    return this.orgService.updateOrganization(id, dto, {
      id: user.id,
      platformRole: user.platformRole,
      organizationId: resellerOrgId,
    });
  }

  @Get('usage')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Usage breakdown across all child clients' })
  async getUsage(@Req() req: Request) {
    const { resellerOrgId } = this.verifyReseller(req);
    const clients = await this.orgService.listOrganizations(OrganizationType.CLIENT, resellerOrgId);
    const usages = await Promise.all(
      clients.map(async (client) => {
        const usage = await this.orgService.getMonthlyUsage(client.id);
        const limits = await this.planService.getEffectiveLimits(client.id, client.planId);
        return {
          organizationId: client.id,
          organizationName: client.name,
          usage,
          limits,
        };
      }),
    );

    return usages;
  }
}
