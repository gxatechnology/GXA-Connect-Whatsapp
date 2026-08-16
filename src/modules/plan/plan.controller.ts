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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import { PlanService } from './plan.service';
import { CreatePlanDto, UpdatePlanDto, SetLimitOverrideDto } from './dto/plan.dto';
import { RequireRole } from '../auth/decorators/auth.decorators';
import { ApiKeyRole } from '../auth/entities/api-key.entity';
import { User, PlatformRole } from '../user/entities/user.entity';

@ApiTags('plans')
@Controller('plans')
export class PlanController {
  constructor(private readonly planService: PlanService) {}

  @Get()
  @RequireRole(ApiKeyRole.VIEWER)
  @ApiOperation({ summary: 'List all active plans' })
  async findAll() {
    return this.planService.findAll();
  }

  @Get(':id')
  @RequireRole(ApiKeyRole.VIEWER)
  @ApiOperation({ summary: 'Get plan by ID' })
  async findOne(@Param('id') id: string) {
    return this.planService.findById(id);
  }

  @Post()
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Create new plan (Super Admin only)' })
  async create(@Body() dto: CreatePlanDto, @Req() req: Request) {
    const user = (req as Request & { user?: User }).user;
    if (user && user.platformRole !== PlatformRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only Super Administrators can create plans');
    }
    return this.planService.create(dto);
  }

  @Patch(':id')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Update plan (Super Admin only)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePlanDto,
    @Req() req: Request,
  ) {
    const user = (req as Request & { user?: User }).user;
    if (user && user.platformRole !== PlatformRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only Super Administrators can modify plans');
    }
    return this.planService.update(id, dto);
  }

  @Delete(':id')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Archive plan (Super Admin only)' })
  async delete(@Param('id') id: string, @Req() req: Request) {
    const user = (req as Request & { user?: User }).user;
    if (user && user.platformRole !== PlatformRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only Super Administrators can delete plans');
    }
    return this.planService.delete(id);
  }

  @Get('override/:organizationId')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Get custom limit override for organization' })
  async getOverride(@Param('organizationId') orgId: string) {
    return this.planService.getLimitOverride(orgId);
  }

  @Post('override/:organizationId')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Set custom limit override for organization (Super Admin only)' })
  async setOverride(
    @Param('organizationId') orgId: string,
    @Body() dto: SetLimitOverrideDto,
    @Req() req: Request,
  ) {
    const user = (req as Request & { user?: User }).user;
    if (user && user.platformRole !== PlatformRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only Super Administrators can override organization limits');
    }
    return this.planService.setLimitOverride(orgId, dto);
  }
}
