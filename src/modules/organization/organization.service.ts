import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Between } from 'typeorm';
import { Organization, OrganizationType, OrganizationStatus } from './entities/organization.entity';
import { OrganizationMember, MemberStatus } from './entities/organization-member.entity';
import { OrganizationUsage } from './entities/organization-usage.entity';
import { User, PlatformRole, UserRole, UserStatus } from '../user/entities/user.entity';
import { PlanService } from '../plan/plan.service';
import { CreateOrganizationDto, UpdateOrganizationDto, AddMemberDto, UpdateMemberRoleDto } from './dto/organization.dto';
import { hashPassword } from '../auth/password.util';
import { sanitizeUser } from '../user/user.service';
import { createLogger } from '../../common/services/logger.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../audit/entities/audit-log.entity';

export function normalizeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function getCurrentMonthBounds(date = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { start, end };
}

@Injectable()
export class OrganizationService implements OnModuleInit {
  private readonly logger = createLogger('OrganizationService');

  constructor(
    @InjectRepository(Organization, 'main')
    private readonly orgRepository: Repository<Organization>,
    @InjectRepository(OrganizationMember, 'main')
    private readonly memberRepository: Repository<OrganizationMember>,
    @InjectRepository(OrganizationUsage, 'main')
    private readonly usageRepository: Repository<OrganizationUsage>,
    @InjectRepository(User, 'main')
    private readonly userRepository: Repository<User>,
    private readonly planService: PlanService,
    private readonly auditService: AuditService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureDefaultPlatformOrganization();
  }

  /**
   * Ensures default platform organization exists on boot so pre-Phase-4B data is never orphaned.
   */
  async ensureDefaultPlatformOrganization(): Promise<Organization> {
    const defaultOrgId = 'org-platform-default';
    let defaultOrg = await this.orgRepository.findOne({ where: { id: defaultOrgId } });
    if (!defaultOrg) {
      defaultOrg = await this.orgRepository.findOne({ where: { slug: 'default' } });
    }

    if (!defaultOrg) {
      defaultOrg = this.orgRepository.create({
        id: defaultOrgId,
        name: 'GXA Platform',
        slug: 'default',
        type: OrganizationType.PLATFORM,
        status: OrganizationStatus.ACTIVE,
        timezone: 'UTC',
      });
      await this.orgRepository.save(defaultOrg);
      this.logger.log('Default platform organization verified (org-platform-default)');
    }

    return defaultOrg;
  }

  // ── Organizations CRUD ───────────────────────────────────────────────

  async createOrganization(
    dto: CreateOrganizationDto,
    actor?: { id?: string; platformRole?: PlatformRole; organizationId?: string; name?: string },
  ): Promise<Organization> {
    const slug = normalizeSlug(dto.slug || dto.name);
    if (!slug) {
      throw new BadRequestException('A valid workspace slug is required');
    }

    const existingSlug = await this.orgRepository.findOne({ where: { slug } });
    if (existingSlug) {
      throw new ConflictException(`Workspace slug "${slug}" is already taken`);
    }

    // Role & Hierarchy enforcement
    let parentOrgId = dto.parentOrganizationId || null;
    let orgType = dto.type || OrganizationType.CLIENT;

    if (actor?.platformRole === PlatformRole.RESELLER_ADMIN) {
      // Reseller can ONLY create child clients under their own organization
      parentOrgId = actor.organizationId || null;
      orgType = OrganizationType.CLIENT;

      if (!parentOrgId) {
        throw new ForbiddenException('Reseller organization context not found');
      }

      // Check reseller client limit
      const currentClientCount = await this.orgRepository.count({
        where: { parentOrganizationId: parentOrgId, status: OrganizationStatus.ACTIVE },
      });
      const parentOrg = await this.orgRepository.findOne({ where: { id: parentOrgId } });
      await this.planService.checkLimit(parentOrgId, parentOrg?.planId || null, 'maxClientOrganizations', currentClientCount);
    }

    const org = this.orgRepository.create({
      name: dto.name.trim(),
      slug,
      type: orgType,
      status: OrganizationStatus.ACTIVE,
      parentOrganizationId: parentOrgId,
      planId: dto.planId || null,
      timezone: dto.timezone || 'UTC',
    });

    const savedOrg = await this.orgRepository.save(org);

    // Initial admin creation if supplied
    if (dto.adminEmail && dto.adminPassword && dto.adminFullName) {
      const normalizedEmail = dto.adminEmail.toLowerCase().trim();
      let adminUser = await this.userRepository.findOne({ where: { email: normalizedEmail } });
      if (!adminUser) {
        adminUser = this.userRepository.create({
          fullName: dto.adminFullName.trim(),
          email: normalizedEmail,
          passwordHash: hashPassword(dto.adminPassword),
          platformRole: orgType === OrganizationType.RESELLER ? PlatformRole.RESELLER_ADMIN : PlatformRole.USER,
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          activeOrganizationId: savedOrg.id,
          tokenVersion: 1,
        });
        adminUser = await this.userRepository.save(adminUser);
      } else if (orgType === OrganizationType.RESELLER && adminUser.platformRole === PlatformRole.USER) {
        adminUser.platformRole = PlatformRole.RESELLER_ADMIN;
        await this.userRepository.save(adminUser);
      }

      savedOrg.ownerUserId = adminUser.id;
      await this.orgRepository.save(savedOrg);

      // Create membership
      const member = this.memberRepository.create({
        organizationId: savedOrg.id,
        userId: adminUser.id,
        role: UserRole.ADMIN,
        status: MemberStatus.ACTIVE,
      });
      await this.memberRepository.save(member);
    }

    void this.auditService.logInfo(AuditAction.API_KEY_CREATED, {
      metadata: { action: 'organization_created', organizationId: savedOrg.id, name: savedOrg.name, type: savedOrg.type },
    });

    return savedOrg;
  }

  async updateOrganization(
    id: string,
    dto: UpdateOrganizationDto,
    actor?: { id?: string; platformRole?: PlatformRole; organizationId?: string; organizationRole?: UserRole },
  ): Promise<Organization> {
    const org = await this.findById(id);

    // Check authorization
    const isSuperAdmin = actor?.platformRole === PlatformRole.SUPER_ADMIN;
    const isResellerParent = actor?.platformRole === PlatformRole.RESELLER_ADMIN && org.parentOrganizationId === actor.organizationId;
    const isClientAdmin = actor?.organizationId === id && actor?.organizationRole === UserRole.ADMIN;

    if (!isSuperAdmin && !isResellerParent && !isClientAdmin) {
      throw new ForbiddenException('You do not have permission to modify this organization');
    }

    if (dto.name !== undefined) org.name = dto.name.trim();
    if (dto.timezone !== undefined) org.timezone = dto.timezone;

    if (dto.slug !== undefined && (isSuperAdmin || isResellerParent)) {
      const slug = normalizeSlug(dto.slug);
      if (slug !== org.slug) {
        const conflict = await this.orgRepository.findOne({ where: { slug } });
        if (conflict) throw new ConflictException(`Slug "${slug}" is already taken`);
        org.slug = slug;
      }
    }

    if (dto.planId !== undefined && (isSuperAdmin || isResellerParent)) {
      org.planId = dto.planId || null;
    }

    if (dto.status !== undefined && (isSuperAdmin || isResellerParent)) {
      org.status = dto.status;
      if (dto.status === OrganizationStatus.SUSPENDED) {
        void this.auditService.logWarn(AuditAction.API_KEY_REVOKED, {
          metadata: { action: 'organization_suspended', organizationId: org.id },
        });
      }
    }

    return this.orgRepository.save(org);
  }

  async findById(id: string): Promise<Organization> {
    const org = await this.orgRepository.findOne({ where: { id } });
    if (!org) {
      throw new NotFoundException(`Organization with ID "${id}" not found`);
    }
    return org;
  }

  async findBySlug(slug: string): Promise<Organization | null> {
    return this.orgRepository.findOne({ where: { slug: normalizeSlug(slug) } });
  }

  async listOrganizations(
    type?: OrganizationType,
    parentOrgId?: string,
    status?: OrganizationStatus,
  ): Promise<Array<Organization & { membersCount: number; planName?: string }>> {
    const qb = this.orgRepository.createQueryBuilder('org');

    if (type) {
      qb.andWhere('org.type = :type', { type });
    }
    if (parentOrgId) {
      qb.andWhere('org.parentOrganizationId = :parentOrgId', { parentOrgId });
    }
    if (status) {
      qb.andWhere('org.status = :status', { status });
    }

    qb.orderBy('org.createdAt', 'DESC');
    const orgs = await qb.getMany();

    if (orgs.length === 0) return [];

    const orgIds = orgs.map(o => o.id);
    const memberCounts = await this.memberRepository
      .createQueryBuilder('m')
      .select('m.organizationId', 'orgId')
      .addSelect('COUNT(m.id)', 'count')
      .where('m.organizationId IN (:...orgIds)', { orgIds })
      .groupBy('m.organizationId')
      .getRawMany<{ orgId: string; count: string }>();

    const countMap = new Map(memberCounts.map(c => [c.orgId, parseInt(c.count, 10) || 0]));

    const plans = await this.planService.findAll();
    const planMap = new Map(plans.map(p => [p.id, p.name]));

    return orgs.map(org => ({
      ...org,
      membersCount: countMap.get(org.id) || 0,
      planName: org.planId ? planMap.get(org.planId) || 'Custom' : 'Standard',
    }));
  }

  // ── Organization Membership ──────────────────────────────────────────

  async getMembers(organizationId: string): Promise<Array<OrganizationMember & { user: Omit<User, 'passwordHash'> }>> {
    const members = await this.memberRepository.find({
      where: { organizationId },
      order: { createdAt: 'ASC' },
    });

    if (members.length === 0) return [];

    const userIds = members.map(m => m.userId);
    const users = await this.userRepository.find({ where: { id: In(userIds) } });
    const userMap = new Map(users.map(u => [u.id, sanitizeUser(u)]));

    return members
      .map(m => ({
        ...m,
        user: userMap.get(m.userId)!,
      }))
      .filter(m => !!m.user);
  }

  async addMember(
    organizationId: string,
    dto: AddMemberDto,
    actor?: { id?: string; organizationRole?: UserRole; platformRole?: PlatformRole },
  ): Promise<OrganizationMember & { user: Omit<User, 'passwordHash'> }> {
    const org = await this.findById(organizationId);

    // Limit check
    const currentMemberCount = await this.memberRepository.count({
      where: { organizationId, status: MemberStatus.ACTIVE },
    });
    await this.planService.checkLimit(organizationId, org.planId, 'maxUsers', currentMemberCount);

    const email = dto.email.toLowerCase().trim();
    let user = await this.userRepository.findOne({ where: { email } });

    if (!user) {
      const password = dto.password || 'GxaConnect123!';
      user = this.userRepository.create({
        fullName: dto.fullName.trim(),
        email,
        passwordHash: hashPassword(password),
        platformRole: PlatformRole.USER,
        role: dto.role || UserRole.AGENT,
        status: UserStatus.ACTIVE,
        activeOrganizationId: organizationId,
        tokenVersion: 1,
      });
      user = await this.userRepository.save(user);
    }

    const existingMember = await this.memberRepository.findOne({
      where: { organizationId, userId: user.id },
    });
    if (existingMember) {
      throw new ConflictException(`User "${email}" is already a member of this workspace`);
    }

    const member = this.memberRepository.create({
      organizationId,
      userId: user.id,
      role: dto.role || UserRole.AGENT,
      status: MemberStatus.ACTIVE,
    });

    const saved = await this.memberRepository.save(member);
    return { ...saved, user: sanitizeUser(user) };
  }

  async updateMemberRole(
    organizationId: string,
    memberId: string,
    role: UserRole,
  ): Promise<OrganizationMember> {
    const member = await this.memberRepository.findOne({
      where: { id: memberId, organizationId },
    });
    if (!member) throw new NotFoundException('Member not found in organization');

    member.role = role;
    return this.memberRepository.save(member);
  }

  async removeMember(organizationId: string, memberId: string): Promise<{ success: boolean }> {
    const member = await this.memberRepository.findOne({
      where: { id: memberId, organizationId },
    });
    if (member) {
      await this.memberRepository.delete({ id: memberId });
    }
    return { success: true };
  }

  async getUserOrganizations(userId: string): Promise<Array<{ organization: Organization; role: UserRole }>> {
    const members = await this.memberRepository.find({
      where: { userId, status: MemberStatus.ACTIVE },
    });

    if (members.length === 0) return [];

    const orgIds = members.map(m => m.organizationId);
    const orgs = await this.orgRepository.find({ where: { id: In(orgIds), status: OrganizationStatus.ACTIVE } });
    const orgMap = new Map(orgs.map(o => [o.id, o]));

    return members
      .map(m => ({
        organization: orgMap.get(m.organizationId)!,
        role: m.role,
      }))
      .filter(entry => !!entry.organization);
  }

  // ── Organization Switch ───────────────────────────────────────────────

  async switchOrganization(
    userId: string,
    targetOrgId: string,
    userPlatformRole?: PlatformRole,
  ): Promise<{ organization: Organization; role: UserRole }> {
    const targetOrg = await this.findById(targetOrgId);
    if (targetOrg.status === OrganizationStatus.SUSPENDED) {
      throw new ForbiddenException('Organization workspace is suspended');
    }

    let role = UserRole.VIEWER;

    if (userPlatformRole === PlatformRole.SUPER_ADMIN) {
      role = UserRole.ADMIN;
    } else {
      const membership = await this.memberRepository.findOne({
        where: { userId, organizationId: targetOrgId, status: MemberStatus.ACTIVE },
      });
      if (!membership) {
        throw new ForbiddenException('You do not have active membership in this organization');
      }
      role = membership.role;
    }

    await this.userRepository.update(userId, { activeOrganizationId: targetOrgId });

    void this.auditService.logInfo(AuditAction.ORGANIZATION_SWITCHED, {
      metadata: { action: 'organization_context_switched', userId, targetOrganizationId: targetOrgId },
    });

    return { organization: targetOrg, role };
  }

  // ── Usage Tracking ───────────────────────────────────────────────────

  async recordUsage(organizationId: string, type: 'message' | 'campaign', count = 1): Promise<void> {
    try {
      const { start, end } = getCurrentMonthBounds();
      let usage = await this.usageRepository.findOne({
        where: { organizationId, periodStart: start },
      });

      if (!usage) {
        usage = this.usageRepository.create({
          organizationId,
          periodStart: start,
          periodEnd: end,
          messagesSent: 0,
          campaignRecipientsProcessed: 0,
        });
      }

      if (type === 'message') {
        usage.messagesSent += count;
      } else if (type === 'campaign') {
        usage.campaignRecipientsProcessed += count;
      }

      await this.usageRepository.save(usage);
    } catch (err) {
      this.logger.warn('Failed to record organization usage', { error: String(err) });
    }
  }

  async getMonthlyUsage(organizationId: string): Promise<OrganizationUsage> {
    const { start, end } = getCurrentMonthBounds();
    let usage = await this.usageRepository.findOne({
      where: { organizationId, periodStart: start },
    });

    if (!usage) {
      usage = this.usageRepository.create({
        organizationId,
        periodStart: start,
        periodEnd: end,
        messagesSent: 0,
        campaignRecipientsProcessed: 0,
      });
    }

    return usage;
  }

  // ── Super Admin Platform Overview ────────────────────────────────────

  async getPlatformOverview(): Promise<{
    activeResellers: number;
    activeClients: number;
    totalOrganizations: number;
    totalUsers: number;
    monthlyMessagesSent: number;
    monthlyCampaignRecipients: number;
  }> {
    const [resellers, clients, totalOrgs, totalUsers] = await Promise.all([
      this.orgRepository.count({ where: { type: OrganizationType.RESELLER, status: OrganizationStatus.ACTIVE } }),
      this.orgRepository.count({ where: { type: OrganizationType.CLIENT, status: OrganizationStatus.ACTIVE } }),
      this.orgRepository.count(),
      this.userRepository.count(),
    ]);

    const { start } = getCurrentMonthBounds();
    const usages = await this.usageRepository.find({ where: { periodStart: start } });
    const monthlyMessagesSent = usages.reduce((acc, u) => acc + (u.messagesSent || 0), 0);
    const monthlyCampaignRecipients = usages.reduce((acc, u) => acc + (u.campaignRecipientsProcessed || 0), 0);

    return {
      activeResellers: resellers,
      activeClients: clients,
      totalOrganizations: totalOrgs,
      totalUsers,
      monthlyMessagesSent,
      monthlyCampaignRecipients,
    };
  }

  // ── Reseller Overview ────────────────────────────────────────────────

  async getResellerOverview(resellerOrgId: string): Promise<{
    totalClients: number;
    activeClients: number;
    totalUsers: number;
    monthlyMessagesSent: number;
  }> {
    const childOrgs = await this.orgRepository.find({
      where: { parentOrganizationId: resellerOrgId },
    });

    const activeClients = childOrgs.filter(o => o.status === OrganizationStatus.ACTIVE).length;
    const childOrgIds = childOrgs.map(o => o.id);

    let totalUsers = 0;
    let monthlyMessagesSent = 0;

    if (childOrgIds.length > 0) {
      totalUsers = await this.memberRepository.count({
        where: { organizationId: In(childOrgIds) },
      });

      const { start } = getCurrentMonthBounds();
      const usages = await this.usageRepository.find({
        where: { organizationId: In(childOrgIds), periodStart: start },
      });
      monthlyMessagesSent = usages.reduce((acc, u) => acc + (u.messagesSent || 0), 0);
    }

    return {
      totalClients: childOrgs.length,
      activeClients,
      totalUsers,
      monthlyMessagesSent,
    };
  }
}
