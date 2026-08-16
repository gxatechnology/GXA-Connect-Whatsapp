import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import type { Request } from 'express';
import { OrganizationService } from './organization.service';
import { PlanService } from '../plan/plan.service';
import { CreateOrganizationDto, UpdateOrganizationDto } from './dto/organization.dto';
import { OrganizationType, OrganizationStatus } from './entities/organization.entity';
import { RequireRole } from '../auth/decorators/auth.decorators';
import { ApiKeyRole } from '../auth/entities/api-key.entity';
import { User, PlatformRole } from '../user/entities/user.entity';

@ApiTags('platform')
@Controller('platform')
export class PlatformController {
  constructor(
    private readonly orgService: OrganizationService,
    private readonly planService: PlanService,
  ) {}

  private verifySuperAdmin(req: Request): User {
    const user = (req as Request & { user?: User }).user;
    if (!user) throw new UnauthorizedException('Authentication required');
    if (user.platformRole !== PlatformRole.SUPER_ADMIN) {
      throw new ForbiddenException('Access restricted to Super Administrators');
    }
    return user;
  }

  @Get('overview')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Platform-wide executive overview statistics' })
  async getOverview(@Req() req: Request) {
    this.verifySuperAdmin(req);
    return this.orgService.getPlatformOverview();
  }

  @Get('resellers')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'List all reseller organizations' })
  async getResellers(@Req() req: Request, @Query('status') status?: OrganizationStatus) {
    this.verifySuperAdmin(req);
    return this.orgService.listOrganizations(OrganizationType.RESELLER, undefined, status);
  }

  @Post('resellers')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Create a new reseller organization' })
  async createReseller(@Body() dto: CreateOrganizationDto, @Req() req: Request) {
    const user = this.verifySuperAdmin(req);
    return this.orgService.createOrganization(
      { ...dto, type: OrganizationType.RESELLER },
      { id: user.id, platformRole: user.platformRole, name: user.fullName },
    );
  }

  @Get('clients')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'List all client organizations' })
  async getClients(
    @Req() req: Request,
    @Query('parentOrgId') parentOrgId?: string,
    @Query('status') status?: OrganizationStatus,
  ) {
    this.verifySuperAdmin(req);
    return this.orgService.listOrganizations(OrganizationType.CLIENT, parentOrgId, status);
  }

  @Post('clients')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Create a direct client organization' })
  async createClient(@Body() dto: CreateOrganizationDto, @Req() req: Request) {
    const user = this.verifySuperAdmin(req);
    return this.orgService.createOrganization(
      { ...dto, type: OrganizationType.CLIENT },
      { id: user.id, platformRole: user.platformRole, name: user.fullName },
    );
  }

  @Get('organizations/:id')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Get organization details by ID' })
  async getOrganization(@Param('id') id: string, @Req() req: Request) {
    this.verifySuperAdmin(req);
    const org = await this.orgService.findById(id);
    const limits = await this.planService.getEffectiveLimits(org.id, org.planId);
    const usage = await this.orgService.getMonthlyUsage(org.id);
    const members = await this.orgService.getMembers(org.id);

    return {
      organization: org,
      limits,
      usage,
      members,
    };
  }

  @Patch('organizations/:id')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Update organization status, plan, or configuration' })
  async updateOrganization(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
    @Req() req: Request,
  ) {
    const user = this.verifySuperAdmin(req);
    return this.orgService.updateOrganization(id, dto, {
      id: user.id,
      platformRole: user.platformRole,
    });
  }
}
