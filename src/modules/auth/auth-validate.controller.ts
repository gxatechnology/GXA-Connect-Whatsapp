import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentApiKey, Public } from './decorators/auth.decorators';
import { ApiKey } from './entities/api-key.entity';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { LoginDto, LoginResponseDto } from './dto/login.dto';
import { ChangePasswordDto } from '../user/dto/user.dto';
import { User } from '../user/entities/user.entity';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';

@ApiTags('auth')
@Controller('auth')
export class AuthValidateController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
    private readonly auditService: AuditService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto, @Req() req: Request): Promise<LoginResponseDto> {
    const clientIp = (req as Request & { clientIp?: string }).clientIp;
    const res = await this.authService.loginUser(dto, clientIp);
    void this.auditService.logInfo(AuditAction.API_KEY_AUTH_FAILED, {
      ipAddress: clientIp,
      method: req.method,
      path: req.path,
      metadata: { action: 'user_login', email: res.user.email, role: res.user.role },
    });
    return res;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User logout and session revocation' })
  async logout(@Req() req: Request): Promise<{ success: boolean }> {
    const user = (req as Request & { user?: User }).user;
    if (user?.id) {
      await this.userService.invalidateUserSessions(user.id);
    }
    return { success: true };
  }

  @Get('me')
  @ApiOperation({ summary: 'Get currently authenticated user/token profile' })
  async me(@Req() req: Request): Promise<{
    user?: Omit<User, 'passwordHash'>;
    role: string;
    authType: 'user' | 'api-key';
  }> {
    const user = (req as Request & { user?: User }).user;
    const apiKey = (req as Request & { apiKey?: ApiKey }).apiKey;

    if (user) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordHash, ...safeUser } = user;
      return {
        user: safeUser,
        role: user.role,
        authType: 'user',
      };
    }

    if (apiKey) {
      return {
        role: apiKey.role,
        authType: 'api-key',
      };
    }

    throw new UnauthorizedException('Not authenticated');
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password for currently authenticated user' })
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ): Promise<{ success: boolean }> {
    const user = (req as Request & { user?: User }).user;
    if (!user) {
      throw new UnauthorizedException('Password change requires a user login session');
    }
    return this.userService.changePassword(user.id, dto);
  }

  @Post('validate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate an API key or session' })
  @ApiHeader({ name: 'X-API-Key', description: 'API key to validate' })
  @ApiResponse({ status: 200, description: 'API key is valid' })
  @ApiResponse({ status: 401, description: 'Invalid or missing API key' })
  validate(
    @CurrentApiKey() apiKey?: ApiKey,
    @Req() req?: Request,
  ): { valid: boolean; role?: string; user?: Omit<User, 'passwordHash'> } {
    const user = (req as Request & { user?: User } | undefined)?.user;
    if (user) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordHash, ...safeUser } = user;
      return { valid: true, role: user.role, user: safeUser };
    }

    if (!apiKey) {
      return { valid: false };
    }
    return { valid: true, role: apiKey.role };
  }
}
