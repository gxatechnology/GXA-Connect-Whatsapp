import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { ApiKey, ApiKeyRole } from '../entities/api-key.entity';
import { REQUIRED_ROLE_KEY, PUBLIC_KEY, SESSION_SCOPED_KEY, UNSCOPED_KEY } from '../decorators/auth.decorators';
import { resolveClientIp } from '../../../common/utils/ip';
import { setRequestActor } from '../../../common/services/request-context';
import { AuditService } from '../../audit/audit.service';
import { AuditAction } from '../../audit/entities/audit-log.entity';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [context.getHandler(), context.getClass()]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    try {
      return await this.authorize(request, context);
    } catch (err) {
      // Record rejected/denied authentication attempts so the audit log has a forensic trail for
      // credential probing. Fire-and-forget: audit logging is best-effort and must never turn a
      // 401/403 into a failure of the guard itself.
      if (err instanceof UnauthorizedException || err instanceof ForbiddenException) {
        // Stamp at least the IP so the failed-auth audit row below is attributable even though the
        // key was never resolved. setRequestActor is a no-op outside a request scope.
        setRequestActor({ ipAddress: this.getClientIp(request) });
        void this.auditService.logWarn(AuditAction.API_KEY_AUTH_FAILED, {
          ipAddress: this.getClientIp(request),
          method: request.method,
          path: request.path,
          errorMessage: err.message,
        });
      }
      throw err;
    }
  }

  private async authorize(request: Request, context: ExecutionContext): Promise<boolean> {
    const apiKeyHeader = this.extractApiKey(request);

    if (!apiKeyHeader) {
      throw new UnauthorizedException('Authentication required');
    }

    const clientIp = this.getClientIp(request);

    // Handle user session tokens (owa_usr_...)
    if (apiKeyHeader.startsWith('owa_usr_')) {
      const user = await this.authService.validateUserToken(apiKeyHeader);
      const requiredRole = this.reflector.getAllAndOverride<ApiKeyRole>(REQUIRED_ROLE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);

      if (requiredRole && !this.authService.hasPermission(user, requiredRole)) {
        throw new ForbiddenException(`Insufficient permissions. Required: ${requiredRole}`);
      }

      const orgId = user.activeOrganizationId || 'org-platform-default';
      const syntheticApiKey = {
        id: user.id,
        name: user.fullName,
        keyPrefix: 'user',
        role: user.role === 'admin' ? ApiKeyRole.ADMIN : (user.role === 'viewer' ? ApiKeyRole.VIEWER : ApiKeyRole.OPERATOR),
        organizationId: orgId,
        allowedIps: null,
        allowedSessions: null,
        isActive: user.status === 'active',
        expiresAt: null,
        lastUsedAt: new Date(),
        usageCount: 0,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      } as unknown as ApiKey;

      (request as Request & { apiKey?: ApiKey; user?: typeof user; clientIp?: string; organizationId?: string; organizationRole?: string; platformRole?: string }).user = user;
      (request as Request & { apiKey?: ApiKey; user?: typeof user; clientIp?: string; organizationId?: string; organizationRole?: string; platformRole?: string }).apiKey = syntheticApiKey;
      (request as Request & { apiKey?: ApiKey; user?: typeof user; clientIp?: string; organizationId?: string; organizationRole?: string; platformRole?: string }).clientIp = clientIp;
      (request as Request & { organizationId?: string; organizationRole?: string; platformRole?: string }).organizationId = orgId;
      (request as Request & { organizationId?: string; organizationRole?: string; platformRole?: string }).organizationRole = user.role;
      (request as Request & { organizationId?: string; organizationRole?: string; platformRole?: string }).platformRole = user.platformRole;

      setRequestActor({ apiKeyId: user.id, apiKeyName: user.fullName, ipAddress: clientIp });
      return true;
    }

    const requiredRole = this.reflector.getAllAndOverride<ApiKeyRole>(REQUIRED_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Resolve the session id used for the key's allowedSessions scope.
    const sessionScoped = this.reflector.getAllAndOverride<boolean>(SESSION_SCOPED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const sessionId = (request.params['sessionId'] || (sessionScoped ? request.params['id'] : undefined)) as
      string | undefined;

    // Validate API key
    const apiKey = await this.authService.validateApiKey(apiKeyHeader, clientIp, sessionId);

    if (requiredRole && !this.authService.hasPermission(apiKey, requiredRole)) {
      throw new ForbiddenException(`Insufficient permissions. Required: ${requiredRole}`);
    }

    const requireUnscoped = this.reflector.getAllAndOverride<boolean>(UNSCOPED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requireUnscoped && (apiKey.allowedSessions?.length ?? 0) > 0) {
      throw new ForbiddenException('Session-scoped API keys are not permitted on this route');
    }

    const apiKeyOrgId = apiKey.organizationId || 'org-platform-default';

    // Attach API key to request for use in controllers
    (request as Request & { apiKey: typeof apiKey; organizationId?: string; organizationRole?: string; platformRole?: string }).apiKey = apiKey;
    (request as Request & { clientIp?: string }).clientIp = clientIp;
    (request as Request & { organizationId?: string; organizationRole?: string; platformRole?: string }).organizationId = apiKeyOrgId;
    (request as Request & { organizationId?: string; organizationRole?: string; platformRole?: string }).organizationRole = apiKey.role;
    (request as Request & { organizationId?: string; organizationRole?: string; platformRole?: string }).platformRole = 'user';

    setRequestActor({ apiKeyId: apiKey.id, apiKeyName: apiKey.name, ipAddress: clientIp });

    return true;
  }

  private extractApiKey(request: Request): string | undefined {
    // Support X-Auth-Token, X-API-Key header and Authorization Bearer
    const xAuthToken = request.headers['x-auth-token'] as string;
    if (xAuthToken) return xAuthToken;

    const xApiKey = request.headers['x-api-key'] as string;
    if (xApiKey) return xApiKey;

    const authHeader = request.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return undefined;
  }

  /**
   * Resolve the real client IP used for the API key's allowedIps whitelist.
   *
   * X-Forwarded-For is client-controllable, so it is only honored when the
   * request actually arrives from a configured trusted proxy (TRUSTED_PROXIES).
   * With no trusted proxies configured, the header is ignored entirely and the
   * direct socket address is used — preventing IP-whitelist spoofing.
   */
  private getClientIp(request: Request): string {
    const trustedProxies = this.configService.get<string[]>('security.trustedProxies') ?? [];
    return resolveClientIp(request, trustedProxies);
  }
}
