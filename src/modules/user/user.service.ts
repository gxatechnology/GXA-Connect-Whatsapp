import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User, PlatformRole, UserRole, UserStatus } from './entities/user.entity';
import { Organization } from '../organization/entities/organization.entity';
import { OrganizationMember, MemberStatus } from '../organization/entities/organization-member.entity';
import { PlanService } from '../plan/plan.service';
import { CreateUserDto, UpdateUserDto, ChangePasswordDto } from './dto/user.dto';
import { hashPassword, verifyPassword } from '../auth/password.util';
import { createLogger } from '../../common/services/logger.service';

export function sanitizeUser(user: User): Omit<User, 'passwordHash'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...safe } = user;
  return safe;
}

@Injectable()
export class UserService implements OnModuleInit {
  private readonly logger = createLogger('UserService');

  constructor(
    @InjectRepository(User, 'main')
    private readonly userRepository: Repository<User>,
    @InjectRepository(Organization, 'main')
    private readonly orgRepository: Repository<Organization>,
    @InjectRepository(OrganizationMember, 'main')
    private readonly memberRepository: Repository<OrganizationMember>,
    private readonly planService: PlanService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.bootstrapAdmin();
  }

  /**
   * Bootstraps the initial administrator account ONLY when:
   * 1. No users exist in the database, AND
   * 2. Valid bootstrap credentials (ADMIN_EMAIL and ADMIN_PASSWORD with >= 8 chars) are explicitly configured.
   */
  async bootstrapAdmin(): Promise<void> {
    try {
      const count = await this.userRepository.count();
      if (count === 0) {
        const rawEmail = process.env.ADMIN_EMAIL;
        const rawPassword = process.env.ADMIN_PASSWORD;
        const fullName = (process.env.ADMIN_NAME || process.env.ADMIN_FULL_NAME || 'System Administrator').trim();

        if (rawEmail && rawPassword) {
          const email = rawEmail.toLowerCase().trim();
          if (rawPassword.length < 8) {
            this.logger.warn(
              'Bootstrap admin password must be at least 8 characters. Administrator account was not created.',
            );
            return;
          }

          const defaultOrgId = 'org-platform-default';
          const admin = this.userRepository.create({
            fullName,
            email,
            passwordHash: hashPassword(rawPassword),
            platformRole: PlatformRole.SUPER_ADMIN,
            role: UserRole.ADMIN,
            status: UserStatus.ACTIVE,
            activeOrganizationId: defaultOrgId,
            tokenVersion: 1,
          });

          const savedAdmin = await this.userRepository.save(admin);
          this.logger.log(`Initial administrator account created (${email})`);

          // Ensure membership in default platform org
          await this.memberRepository.save(
            this.memberRepository.create({
              organizationId: defaultOrgId,
              userId: savedAdmin.id,
              role: UserRole.ADMIN,
              status: MemberStatus.ACTIVE,
            }),
          ).catch(() => {});
        } else {
          this.logger.log(
            'No users exist in the database. To bootstrap the first Administrator, configure ADMIN_EMAIL and ADMIN_PASSWORD (min 8 chars) in your environment, or create an administrator using the API master key.',
          );
        }
      }
    } catch (err) {
      this.logger.warn('Failed to evaluate initial admin bootstrap', { error: String(err) });
    }
  }

  async findAll(organizationId?: string): Promise<Array<Omit<User, 'passwordHash'>>> {
    if (organizationId) {
      const members = await this.memberRepository.find({
        where: { organizationId, status: MemberStatus.ACTIVE },
      });
      if (members.length === 0) return [];
      const userIds = members.map(m => m.userId);
      const users = await this.userRepository.find({
        where: { id: In(userIds) },
        order: { createdAt: 'ASC' },
      });
      const memberRoleMap = new Map(members.map(m => [m.userId, m.role]));
      return users.map(u => {
        const safe = sanitizeUser(u);
        return {
          ...safe,
          role: memberRoleMap.get(u.id) || u.role,
        };
      });
    }

    const users = await this.userRepository.find({
      order: { createdAt: 'ASC' },
    });
    return users.map(sanitizeUser);
  }

  async findById(id: string, organizationId?: string): Promise<Omit<User, 'passwordHash'>> {
    if (organizationId) {
      const membership = await this.memberRepository.findOne({
        where: { userId: id, organizationId, status: MemberStatus.ACTIVE },
      });
      if (!membership) {
        throw new NotFoundException(`User with ID "${id}" not found in this organization workspace`);
      }
    }

    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }
    return sanitizeUser(user);
  }

  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: email.toLowerCase().trim() })
      .getOne();
  }

  async create(dto: CreateUserDto, organizationId?: string): Promise<Omit<User, 'passwordHash'>> {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const existing = await this.userRepository.findOne({ where: { email: normalizedEmail } });
    if (existing) {
      throw new ConflictException(`User with email "${normalizedEmail}" already exists`);
    }

    if (!dto.password || dto.password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }

    if (organizationId) {
      const org = await this.orgRepository.findOne({ where: { id: organizationId } });
      const currentMemberCount = await this.memberRepository.count({
        where: { organizationId, status: MemberStatus.ACTIVE },
      });
      await this.planService.checkLimit(organizationId, org?.planId || null, 'maxUsers', currentMemberCount);
    }

    const user = this.userRepository.create({
      fullName: dto.fullName.trim(),
      email: normalizedEmail,
      passwordHash: hashPassword(dto.password),
      platformRole: PlatformRole.USER,
      role: dto.role || UserRole.AGENT,
      status: UserStatus.ACTIVE,
      activeOrganizationId: organizationId || 'org-platform-default',
      tokenVersion: 1,
    });

    const saved = await this.userRepository.save(user);

    if (organizationId) {
      await this.memberRepository.save(
        this.memberRepository.create({
          organizationId,
          userId: saved.id,
          role: dto.role || UserRole.AGENT,
          status: MemberStatus.ACTIVE,
        }),
      );
    }

    return sanitizeUser(saved);
  }

  async update(id: string, dto: UpdateUserDto, organizationId?: string): Promise<Omit<User, 'passwordHash'>> {
    if (organizationId) {
      const membership = await this.memberRepository.findOne({
        where: { userId: id, organizationId, status: MemberStatus.ACTIVE },
      });
      if (!membership) {
        throw new NotFoundException(`User with ID "${id}" not found in this organization workspace`);
      }
      if (dto.role) {
        membership.role = dto.role;
        await this.memberRepository.save(membership);
      }
    }

    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    // Safety: ensure we do not disable or demote the last active admin
    if (user.role === UserRole.ADMIN && (dto.status === UserStatus.DISABLED || (dto.role && dto.role !== UserRole.ADMIN))) {
      const activeAdminCount = await this.userRepository.count({
        where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
      });
      if (activeAdminCount <= 1) {
        throw new ForbiddenException('Cannot disable or demote the only remaining active administrator');
      }
    }

    if (dto.fullName !== undefined) user.fullName = dto.fullName.trim();
    if (dto.role !== undefined) user.role = dto.role;

    if (dto.status !== undefined) {
      if (dto.status === UserStatus.DISABLED && user.status !== UserStatus.DISABLED) {
        user.tokenVersion = (user.tokenVersion || 1) + 1;
      }
      user.status = dto.status;
    }

    const saved = await this.userRepository.save(user);
    return sanitizeUser(saved);
  }

  async resetPassword(id: string, newPassword: string, organizationId?: string): Promise<{ success: boolean }> {
    if (organizationId) {
      const membership = await this.memberRepository.findOne({
        where: { userId: id, organizationId, status: MemberStatus.ACTIVE },
      });
      if (!membership) {
        throw new NotFoundException(`User with ID "${id}" not found in this organization workspace`);
      }
    }

    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    if (!newPassword || newPassword.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }

    user.passwordHash = hashPassword(newPassword);
    user.tokenVersion = (user.tokenVersion || 1) + 1;
    await this.userRepository.save(user);
    return { success: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ success: boolean }> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id: userId })
      .getOne();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isMatch = verifyPassword(dto.currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    if (!dto.newPassword || dto.newPassword.length < 6) {
      throw new BadRequestException('New password must be at least 6 characters');
    }

    user.passwordHash = hashPassword(dto.newPassword);
    user.tokenVersion = (user.tokenVersion || 1) + 1;
    await this.userRepository.save(user);
    return { success: true };
  }

  async invalidateUserSessions(userId: string): Promise<void> {
    await this.userRepository.increment({ id: userId }, 'tokenVersion', 1);
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.userRepository.update(userId, { lastLoginAt: new Date() });
  }
}
