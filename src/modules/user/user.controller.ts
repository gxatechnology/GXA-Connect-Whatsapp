import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Req,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import { UserService } from './user.service';
import { CreateUserDto, UpdateUserDto, ResetPasswordDto } from './dto/user.dto';
import { RequireRole, CurrentApiKey } from '../auth/decorators/auth.decorators';
import { ApiKey, ApiKeyRole } from '../auth/entities/api-key.entity';
import { User, UserRole, PlatformRole } from './entities/user.entity';

@ApiTags('team')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  private getOrgId(req: Request): string {
    const orgId = (req as Request & { organizationId?: string }).organizationId;
    return orgId || 'org-platform-default';
  }

  @Get()
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'List all workspace users' })
  @ApiResponse({ status: 200, description: 'List of users' })
  async findAll(@Req() req: Request): Promise<Array<Omit<User, 'passwordHash'>>> {
    const actorUser = (req as Request & { user?: User }).user;
    if (actorUser && actorUser.role === UserRole.VIEWER) {
      throw new ForbiddenException('Viewers cannot list users');
    }
    const isSuperAdmin = actorUser?.platformRole === PlatformRole.SUPER_ADMIN;
    return this.userService.findAll(isSuperAdmin ? undefined : this.getOrgId(req));
  }

  @Get(':id')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Get user by ID' })
  async findOne(@Param('id') id: string, @Req() req: Request): Promise<Omit<User, 'passwordHash'>> {
    const actorUser = (req as Request & { user?: User }).user;
    const isSuperAdmin = actorUser?.platformRole === PlatformRole.SUPER_ADMIN;
    return this.userService.findById(id, isSuperAdmin ? undefined : this.getOrgId(req));
  }

  @Post()
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Create a new user (Admin only)' })
  @ApiResponse({ status: 201, description: 'User created' })
  async create(
    @Body() dto: CreateUserDto,
    @Req() req: Request,
  ): Promise<Omit<User, 'passwordHash'>> {
    const actorUser = (req as Request & { user?: User }).user;
    if (actorUser && actorUser.role !== UserRole.ADMIN && actorUser.platformRole !== PlatformRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only Administrators can create new users');
    }
    return this.userService.create(dto, this.getOrgId(req));
  }

  @Patch(':id')
  @RequireRole(ApiKeyRole.ADMIN)
  @ApiOperation({ summary: 'Update user role or status (Admin only)' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @Req() req: Request,
  ): Promise<Omit<User, 'passwordHash'>> {
    const actorUser = (req as Request & { user?: User }).user;
    if (actorUser && actorUser.role !== UserRole.ADMIN && actorUser.platformRole !== PlatformRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only Administrators can update user roles or statuses');
    }
    const isSuperAdmin = actorUser?.platformRole === PlatformRole.SUPER_ADMIN;
    return this.userService.update(id, dto, isSuperAdmin ? undefined : this.getOrgId(req));
  }

  @Patch(':id/password')
  @RequireRole(ApiKeyRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset user password (Admin only)' })
  async resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @Req() req: Request,
  ): Promise<{ success: boolean }> {
    const actorUser = (req as Request & { user?: User }).user;
    if (actorUser && actorUser.role !== UserRole.ADMIN && actorUser.platformRole !== PlatformRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only Administrators can reset passwords');
    }
    const isSuperAdmin = actorUser?.platformRole === PlatformRole.SUPER_ADMIN;
    return this.userService.resetPassword(id, dto.newPassword, isSuperAdmin ? undefined : this.getOrgId(req));
  }
}
