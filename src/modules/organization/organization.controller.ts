import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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
import { AddMemberDto, UpdateMemberRoleDto, SwitchOrganizationDto, UpdateOrganizationDto } from './dto/organization.dto';
import { RequireRole } from '../auth/decorators/auth.decorators';
import { ApiKeyRole } from '../auth/entities/api-key.entity';
import { User, UserRole, PlatformRole } from '../user/entities/user.entity';

@ApiTags('organizations')
@Controller('organizations')
export class OrganizationController {
  constructor(
    private readonly orgService: OrganizationService,
    private readonly planService: PlanService,
  ) {}

  private getUser(req: Request): User {
    const user = (req as Request & { user?: User }).user;
    if (!user) throw new UnauthorizedException('Authentication required');
    return user;
  }

  @Get('me')
  @RequireRole(ApiKeyRole.VIEWER)
  @ApiOperation({ summary: 'Get currently active organization, plan limits, and usage' })
  async getMyOrganization(@Req() req: Request) {
    const user = this.getUser(req);
    const orgId = user.activeOrganizationId || 'org-platform-default';
    const org = await this.orgService.findById(orgId);
    const limits = await this.planService.getEffectiveLimits(org.id, org.planId);
    const usage = await this.orgService.getMonthlyUsage(org.id);

    return {
      organization: org,
      role: user.role,
      platformRole: user.platformRole,
      limits,
      usage,
    };
  }

  @Get('my-workspaces')
  @RequireRole(ApiKeyRole.VIEWER)
  @ApiOperation({ summary: 'List all workspaces accessible to current user' })
  async getMyWorkspaces(@Req() req: Request) {
    const user = this.getUser(req);
    if (user.platformRole === PlatformRole.SUPER_ADMIN) {
      const allOrgs = await this.orgService.listOrganizations();
      return allOrgs.map(org => ({
        organization: org,
        role: UserRole.ADMIN,
      }));
    }
    return this.orgService.getUserOrganizations(user.id);
  }

  @Post('switch')
  @RequireRole(ApiKeyRole.VIEWER)
  @ApiOperation({ summary: 'Switch active workspace context' })
  async switchWorkspace(@Body() dto: SwitchOrganizationDto, @Req() req: Request) {
    const user = this.getUser(req);
    return this.orgService.switchOrganization(user.id, dto.organizationId, user.platformRole);
  }

  @Get('members')
  @RequireRole(ApiKeyRole.VIEWER)
  @ApiOperation({ summary: 'List all members of the active workspace' })
  async getMembers(@Req() req: Request) {
    const user = this.getUser(req);
    const orgId = user.activeOrganizationId || 'org-platform-default';
    return this.orgService.getMembers(orgId);
  }

  @Post('members')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Add member to active workspace' })
  async addMember(@Body() dto: AddMemberDto, @Req() req: Request) {
    const user = this.getUser(req);
    const orgId = user.activeOrganizationId || 'org-platform-default';
    if (user.role !== UserRole.ADMIN && user.platformRole !== PlatformRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only Workspace Administrators can add members');
    }
    return this.orgService.addMember(orgId, dto, {
      id: user.id,
      organizationRole: user.role,
      platformRole: user.platformRole,
    });
  }

  @Patch('members/:id/role')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Update member role in workspace' })
  async updateMemberRole(
    @Param('id') memberId: string,
    @Body() dto: UpdateMemberRoleDto,
    @Req() req: Request,
  ) {
    const user = this.getUser(req);
    const orgId = user.activeOrganizationId || 'org-platform-default';
    if (user.role !== UserRole.ADMIN && user.platformRole !== PlatformRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only Workspace Administrators can update member roles');
    }
    return this.orgService.updateMemberRole(orgId, memberId, dto.role);
  }

  @Delete('members/:id')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Remove member from workspace' })
  async removeMember(@Param('id') memberId: string, @Req() req: Request) {
    const user = this.getUser(req);
    const orgId = user.activeOrganizationId || 'org-platform-default';
    if (user.role !== UserRole.ADMIN && user.platformRole !== PlatformRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only Workspace Administrators can remove members');
    }
    return this.orgService.removeMember(orgId, memberId);
  }

  @Get('usage')
  @RequireRole(ApiKeyRole.VIEWER)
  @ApiOperation({ summary: 'Get monthly message and campaign usage for active workspace' })
  async getUsage(@Req() req: Request) {
    const user = this.getUser(req);
    const orgId = user.activeOrganizationId || 'org-platform-default';
    return this.orgService.getMonthlyUsage(orgId);
  }

  @Patch('me')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Update active workspace settings' })
  async updateMyOrganization(@Body() dto: UpdateOrganizationDto, @Req() req: Request) {
    const user = this.getUser(req);
    const orgId = user.activeOrganizationId || 'org-platform-default';
    if (user.role !== UserRole.ADMIN && user.platformRole !== PlatformRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only Workspace Administrators can modify organization settings');
    }
    return this.orgService.updateOrganization(orgId, dto, {
      id: user.id,
      organizationId: orgId,
      organizationRole: user.role,
      platformRole: user.platformRole,
    });
  }
}
