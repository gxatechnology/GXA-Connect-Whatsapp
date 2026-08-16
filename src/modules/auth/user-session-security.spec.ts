import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { User, UserRole, UserStatus, PlatformRole } from '../user/entities/user.entity';

describe('User Session & Dual Auth Security (AuthService)', () => {
  let authService: AuthService;
  let mockUserRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
    count: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let mockApiKeyRepository: {
    findOne: jest.Mock;
    count: jest.Mock;
    save: jest.Mock;
  };
  let mockUsageTracker: {
    recordUsage: jest.Mock;
    flushOnShutdown: jest.Mock;
  };
  let mockModuleRef: {
    get: jest.Mock;
  };

  const sampleUser: User = {
    id: 'usr-1111-2222',
    fullName: 'Jane Doe',
    email: 'jane@gxa.local',
    passwordHash: 'salt:hash',
    role: UserRole.AGENT,
    platformRole: PlatformRole.USER,
    activeOrganizationId: 'org-platform-default',
    status: UserStatus.ACTIVE,
    tokenVersion: 1,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockUserRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    mockApiKeyRepository = {
      findOne: jest.fn(),
      count: jest.fn(),
      save: jest.fn(),
    };
    mockUsageTracker = {
      recordUsage: jest.fn(),
      flushOnShutdown: jest.fn(),
    };
    mockModuleRef = {
      get: jest.fn(),
    };

    authService = new AuthService(
      mockApiKeyRepository as any,
      mockUserRepository as any,
      mockUsageTracker as any,
      mockModuleRef as any,
    );
  });

  it('mints a valid HMAC-signed token with tokenVersion', () => {
    const token = authService.mintUserToken(sampleUser);
    expect(token).toMatch(/^owa_usr_[A-Za-z0-9_-]+\.[a-f0-9]{64}$/);
  });

  it('validates a correct token and returns the active user', async () => {
    mockUserRepository.findOne.mockResolvedValue(sampleUser);

    const token = authService.mintUserToken(sampleUser);
    const validated = await authService.validateUserToken(token);

    expect(validated.id).toBe(sampleUser.id);
    expect(validated.email).toBe(sampleUser.email);
  });

  it('rejects tampered token payloads or signatures', async () => {
    const token = authService.mintUserToken(sampleUser);
    const [headerAndPayload, sig] = token.split('.');

    // Tamper payload
    const tamperedPayload = Buffer.from(JSON.stringify({ uid: 'usr-hacked', exp: Date.now() + 100000 })).toString('base64url');
    const tamperedToken = `${headerAndPayload.slice(0, 8)}${tamperedPayload}.${sig}`;

    await expect(authService.validateUserToken(tamperedToken)).rejects.toThrow(UnauthorizedException);

    // Tamper signature
    const badSigToken = `${headerAndPayload}.${sig.slice(0, -4)}0000`;
    await expect(authService.validateUserToken(badSigToken)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects expired tokens', async () => {
    const expiredUser = { ...sampleUser };
    const expiredPayload = {
      uid: expiredUser.id,
      email: expiredUser.email,
      role: expiredUser.role,
      name: expiredUser.fullName,
      tokenVersion: 1,
      exp: Date.now() - 10000, // in the past
    };
    const payloadStr = JSON.stringify(expiredPayload);
    const crypto = require('crypto');
    const secret = (authService as any).tokenSecret;
    const signature = crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');
    const expiredToken = `owa_usr_${Buffer.from(payloadStr).toString('base64url')}.${signature}`;

    await expect(authService.validateUserToken(expiredToken)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects tokens with revoked tokenVersion (e.g. after logout or password change)', async () => {
    // User has bumped tokenVersion to 2 in DB
    mockUserRepository.findOne.mockResolvedValue({
      ...sampleUser,
      tokenVersion: 2,
    });

    // Token was minted when tokenVersion was 1
    const oldToken = authService.mintUserToken({ ...sampleUser, tokenVersion: 1 });

    await expect(authService.validateUserToken(oldToken)).rejects.toThrow(
      /Session has been revoked or expired/,
    );
  });

  it('rejects tokens for deactivated / disabled users', async () => {
    mockUserRepository.findOne.mockResolvedValue({
      ...sampleUser,
      status: UserStatus.DISABLED,
    });

    const token = authService.mintUserToken(sampleUser);
    await expect(authService.validateUserToken(token)).rejects.toThrow(
      /User account is deactivated or not found/,
    );
  });

  it('correctly evaluates role hierarchy levels', () => {
    expect(authService.hasPermission({ role: 'admin' }, 'admin')).toBe(true);
    expect(authService.hasPermission({ role: 'admin' }, 'manager')).toBe(true);
    expect(authService.hasPermission({ role: 'admin' }, 'agent')).toBe(true);
    expect(authService.hasPermission({ role: 'admin' }, 'viewer')).toBe(true);

    expect(authService.hasPermission({ role: 'manager' }, 'admin')).toBe(false);
    expect(authService.hasPermission({ role: 'manager' }, 'manager')).toBe(true);
    expect(authService.hasPermission({ role: 'manager' }, 'agent')).toBe(true);
    expect(authService.hasPermission({ role: 'manager' }, 'viewer')).toBe(true);

    expect(authService.hasPermission({ role: 'agent' }, 'manager')).toBe(false);
    expect(authService.hasPermission({ role: 'agent' }, 'agent')).toBe(true);
    expect(authService.hasPermission({ role: 'agent' }, 'viewer')).toBe(true);

    expect(authService.hasPermission({ role: 'viewer' }, 'agent')).toBe(false);
    expect(authService.hasPermission({ role: 'viewer' }, 'viewer')).toBe(true);
  });
});
