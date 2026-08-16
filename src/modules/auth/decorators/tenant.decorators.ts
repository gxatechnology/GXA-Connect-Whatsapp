import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';
import { PlatformRole } from '../../user/entities/user.entity';

export const PLATFORM_ROLE_KEY = 'platform_role';

export const RequirePlatformRole = (role: PlatformRole) => SetMetadata(PLATFORM_ROLE_KEY, role);

export interface RequestTenantContext {
  organizationId: string;
  organizationRole: string;
  platformRole: PlatformRole | string;
  userId?: string;
}

export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): RequestTenantContext => {
    const req = ctx.switchToHttp().getRequest<Request & { organizationId?: string; organizationRole?: string; platformRole?: string; user?: { id: string } }>();
    return {
      organizationId: req.organizationId || 'org-platform-default',
      organizationRole: req.organizationRole || 'agent',
      platformRole: req.platformRole || PlatformRole.USER,
      userId: req.user?.id,
    };
  },
);
