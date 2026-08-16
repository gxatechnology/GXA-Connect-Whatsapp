import { NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { CrmService, normalizePhone } from '../crm/crm.service';
import { PlanService } from '../plan/plan.service';
import { OrganizationService } from './organization.service';
import { OrganizationType, OrganizationStatus } from './entities/organization.entity';
import { MemberStatus } from './entities/organization-member.entity';
import { PlatformRole, UserRole, UserStatus } from '../user/entities/user.entity';
import { LeadStage, LeadStatus, LeadSource } from '../crm/entities/crm-lead.entity';
import { FollowupStatus } from '../crm/entities/crm-followup.entity';

describe('Phase 4B Multi-Tenant & IDOR Security QA Test Suite', () => {
  const orgA = 'org-client-alpha';
  const orgB = 'org-client-beta';
  const resellerOrg = 'org-reseller-1';
  const defaultOrg = 'org-platform-default';

  let mockLeadRepo: any;
  let mockNoteRepo: any;
  let mockTagRepo: any;
  let mockLeadTagRepo: any;
  let mockFollowupRepo: any;
  let mockActivityRepo: any;
  let mockBatchRepo: any;
  let mockUserRepo: any;
  let mockMemberRepo: any;
  let mockOrgRepo: any;
  let mockPlanRepo: any;
  let mockOverrideRepo: any;
  let mockUsageRepo: any;
  let mockAuditService: any;

  let crmService: CrmService;
  let planService: PlanService;
  let orgService: OrganizationService;

  beforeEach(() => {
    // In-memory data structures
    const leads: any[] = [];
    const notes: any[] = [];
    const tags: any[] = [];
    const leadTags: any[] = [];
    const followups: any[] = [];
    const activities: any[] = [];
    const batches: any[] = [];
    const users: any[] = [
      { id: 'usr-admin-1', fullName: 'Super Admin', email: 'admin@gxa.local', role: UserRole.ADMIN, platformRole: PlatformRole.SUPER_ADMIN, status: UserStatus.ACTIVE, tokenVersion: 1 },
      { id: 'usr-agent-a', fullName: 'Agent Alpha', email: 'agent@alpha.com', role: UserRole.AGENT, platformRole: PlatformRole.USER, status: UserStatus.ACTIVE, tokenVersion: 1 },
      { id: 'usr-agent-b', fullName: 'Agent Beta', email: 'agent@beta.com', role: UserRole.AGENT, platformRole: PlatformRole.USER, status: UserStatus.ACTIVE, tokenVersion: 1 },
    ];
    const members: any[] = [
      { id: 'mem-1', organizationId: defaultOrg, userId: 'usr-admin-1', role: UserRole.ADMIN, status: MemberStatus.ACTIVE },
      { id: 'mem-2', organizationId: orgA, userId: 'usr-agent-a', role: UserRole.AGENT, status: MemberStatus.ACTIVE },
      { id: 'mem-3', organizationId: orgB, userId: 'usr-agent-b', role: UserRole.AGENT, status: MemberStatus.ACTIVE },
    ];
    const orgs: any[] = [
      { id: defaultOrg, name: 'GXA Platform', slug: 'default', type: OrganizationType.PLATFORM, status: OrganizationStatus.ACTIVE, planId: null },
      { id: orgA, name: 'Alpha Corp', slug: 'alpha', type: OrganizationType.CLIENT, status: OrganizationStatus.ACTIVE, planId: 'plan-basic' },
      { id: orgB, name: 'Beta Ltd', slug: 'beta', type: OrganizationType.CLIENT, status: OrganizationStatus.ACTIVE, planId: 'plan-pro' },
      { id: resellerOrg, name: 'Reseller One', slug: 'reseller-1', type: OrganizationType.RESELLER, status: OrganizationStatus.ACTIVE, planId: 'plan-reseller' },
    ];
    const plans: any[] = [
      { id: 'plan-basic', name: 'Basic', maxUsers: 2, maxWhatsAppAccounts: 1, maxContacts: 500, maxMonthlyMessages: 1000, maxCampaignRecipients: 100, maxClientOrganizations: null, apiAccess: false, crmEnabled: true, automationEnabled: false, reportsEnabled: false },
      { id: 'plan-pro', name: 'Pro', maxUsers: 10, maxWhatsAppAccounts: 5, maxContacts: 5000, maxMonthlyMessages: 10000, maxCampaignRecipients: 1000, maxClientOrganizations: null, apiAccess: true, crmEnabled: true, automationEnabled: true, reportsEnabled: true },
      { id: 'plan-reseller', name: 'Reseller Plan', maxUsers: 50, maxWhatsAppAccounts: 20, maxContacts: 20000, maxMonthlyMessages: 50000, maxCampaignRecipients: 5000, maxClientOrganizations: 3, apiAccess: true, crmEnabled: true, automationEnabled: true, reportsEnabled: true },
    ];
    const overrides: any[] = [];
    const usages: any[] = [];

    mockLeadRepo = {
      create: jest.fn(dto => ({ id: `lead-${leads.length + 1}`, ...dto, createdAt: new Date(), lastActivityAt: new Date() })),
      save: jest.fn(lead => {
        const idx = leads.findIndex(l => l.id === lead.id);
        if (idx >= 0) leads[idx] = lead;
        else leads.push(lead);
        return lead;
      }),
      findOne: jest.fn(opts => {
        return leads.find(l => {
          if (opts.where.id && l.id !== opts.where.id) return false;
          if (opts.where.organizationId && l.organizationId !== opts.where.organizationId) return false;
          if (opts.where.phone && l.phone !== opts.where.phone) return false;
          if (opts.where.status && l.status !== opts.where.status) return false;
          return true;
        }) || null;
      }),
      find: jest.fn(opts => {
        return leads.filter(l => {
          if (opts.where.organizationId && l.organizationId !== opts.where.organizationId) return false;
          return true;
        });
      }),
      update: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([leads, leads.length]),
      })),
    };

    mockNoteRepo = {
      create: jest.fn(dto => ({ id: `note-${notes.length + 1}`, ...dto, createdAt: new Date() })),
      save: jest.fn(note => { notes.push(note); return note; }),
      findOne: jest.fn(opts => notes.find(n => n.id === opts.where.id && n.organizationId === opts.where.organizationId) || null),
      find: jest.fn(opts => notes.filter(n => n.leadId === opts.where.leadId && n.organizationId === opts.where.organizationId)),
      delete: jest.fn(),
    };

    mockTagRepo = {
      create: jest.fn(dto => ({ id: `tag-${tags.length + 1}`, ...dto })),
      save: jest.fn(tag => { tags.push(tag); return tag; }),
      findOne: jest.fn(opts => tags.find(t => t.name === opts.where.name && t.organizationId === opts.where.organizationId) || null),
      find: jest.fn(opts => tags.filter(t => t.organizationId === opts.where.organizationId)),
      delete: jest.fn(),
    };

    mockLeadTagRepo = {
      create: jest.fn(dto => ({ ...dto })),
      save: jest.fn(lt => { leadTags.push(lt); return lt; }),
      find: jest.fn(opts => leadTags.filter(lt => lt.leadId === opts.where.leadId)),
      findOne: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      })),
    };

    mockFollowupRepo = {
      create: jest.fn(dto => ({ id: `fu-${followups.length + 1}`, ...dto })),
      save: jest.fn(fu => {
        const idx = followups.findIndex(f => f.id === fu.id);
        if (idx >= 0) followups[idx] = fu;
        else followups.push(fu);
        return fu;
      }),
      findOne: jest.fn(opts => followups.find(f => {
        if (opts.where.id && f.id !== opts.where.id) return false;
        if (opts.where.organizationId && f.organizationId !== opts.where.organizationId) return false;
        return true;
      }) || null),
      find: jest.fn(opts => followups.filter(f => f.leadId === opts.where.leadId && f.organizationId === opts.where.organizationId)),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([followups, followups.length]),
      })),
    };

    mockActivityRepo = {
      create: jest.fn(dto => ({ id: `act-${activities.length + 1}`, ...dto, createdAt: new Date() })),
      save: jest.fn(act => { activities.push(act); return act; }),
      find: jest.fn(opts => activities.filter(a => a.leadId === opts.where.leadId && a.organizationId === opts.where.organizationId)),
    };

    mockBatchRepo = {
      find: jest.fn(opts => batches.filter(b => b.organizationId === opts.where.organizationId)),
    };

    mockUserRepo = {
      create: jest.fn(dto => ({ id: `usr-${users.length + 1}`, ...dto })),
      save: jest.fn(u => { users.push(u); return u; }),
      findOne: jest.fn(opts => users.find(u => u.id === opts.where.id || u.email === opts.where.email) || null),
      find: jest.fn(opts => users.filter(u => !opts.where?.id || opts.where.id._value?.includes(u.id))),
      update: jest.fn(),
      count: jest.fn(() => users.length),
    };

    mockMemberRepo = {
      create: jest.fn(dto => ({ id: `mem-${members.length + 1}`, ...dto })),
      save: jest.fn(m => { members.push(m); return m; }),
      findOne: jest.fn(opts => members.find(m => m.organizationId === opts.where.organizationId && m.userId === opts.where.userId && m.status === opts.where.status) || null),
      find: jest.fn(opts => members.filter(m => m.organizationId === opts.where.organizationId && m.status === (opts.where.status || MemberStatus.ACTIVE))),
      count: jest.fn(opts => members.filter(m => m.organizationId === opts.where.organizationId && m.status === (opts.where.status || MemberStatus.ACTIVE)).length),
      delete: jest.fn(),
    };

    mockOrgRepo = {
      create: jest.fn(dto => ({ id: `org-${orgs.length + 1}`, ...dto, createdAt: new Date(), updatedAt: new Date() })),
      save: jest.fn(o => {
        const idx = orgs.findIndex(item => item.id === o.id);
        if (idx >= 0) orgs[idx] = o;
        else orgs.push(o);
        return o;
      }),
      findOne: jest.fn(opts => orgs.find(o => o.id === opts.where.id || o.slug === opts.where.slug) || null),
      find: jest.fn(opts => orgs.filter(o => {
        if (opts.where?.parentOrganizationId && o.parentOrganizationId !== opts.where.parentOrganizationId) return false;
        if (opts.where?.type && o.type !== opts.where.type) return false;
        return true;
      })),
      count: jest.fn(opts => orgs.filter(o => {
        if (opts.where?.parentOrganizationId && o.parentOrganizationId !== opts.where.parentOrganizationId) return false;
        if (opts.where?.status && o.status !== opts.where.status) return false;
        if (opts.where?.type && o.type !== opts.where.type) return false;
        return true;
      }).length),
      createQueryBuilder: jest.fn(() => ({
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(orgs),
      })),
    };

    mockPlanRepo = {
      create: jest.fn(dto => ({ id: `plan-${plans.length + 1}`, ...dto })),
      save: jest.fn(p => { plans.push(p); return p; }),
      findOne: jest.fn(opts => plans.find(p => p.id === opts.where.id || p.name === opts.where.name) || null),
      find: jest.fn(() => plans),
    };

    mockOverrideRepo = {
      findOne: jest.fn(opts => overrides.find(o => o.organizationId === opts.where.organizationId) || null),
      save: jest.fn(o => { overrides.push(o); return o; }),
    };

    mockUsageRepo = {
      create: jest.fn(dto => ({ id: `usage-${usages.length + 1}`, ...dto })),
      save: jest.fn(u => { usages.push(u); return u; }),
      findOne: jest.fn(opts => usages.find(u => u.organizationId === opts.where.organizationId) || null),
      find: jest.fn(() => usages),
    };

    mockAuditService = {
      logInfo: jest.fn(),
      logWarn: jest.fn(),
    };

    planService = new PlanService(mockPlanRepo, mockOverrideRepo);
    orgService = new OrganizationService(mockOrgRepo, mockMemberRepo, mockUsageRepo, mockUserRepo, planService, mockAuditService);
    crmService = new CrmService(
      mockLeadRepo,
      mockNoteRepo,
      mockTagRepo,
      mockLeadTagRepo,
      mockFollowupRepo,
      mockActivityRepo,
      mockBatchRepo,
      mockUserRepo,
      mockMemberRepo,
      planService,
    );
  });

  describe('1. CRM Multi-Tenant Lead Isolation & IDOR Protection', () => {
    it('creates lead strictly scoped to organizationId', async () => {
      const leadA = await crmService.createLead(
        { name: 'Lead Alpha', phone: '+1 555 100 0001' },
        { id: 'usr-agent-a', name: 'Agent Alpha' },
        orgA,
      );

      expect(leadA.organizationId).toBe(orgA);
      expect(leadA.name).toBe('Lead Alpha');
    });

    it('blocks cross-tenant lead retrieval (Org B cannot read Org A lead)', async () => {
      const leadA = await crmService.createLead(
        { name: 'Secret Lead', phone: '+1 555 100 0002' },
        { id: 'usr-agent-a', name: 'Agent Alpha' },
        orgA,
      );

      // Org A can read its own lead
      const foundA = await crmService.findLeadById(leadA.id, orgA);
      expect(foundA.id).toBe(leadA.id);

      // Org B attempts IDOR read of Org A lead -> 404 NotFound
      await expect(crmService.findLeadById(leadA.id, orgB)).rejects.toThrow(NotFoundException);
    });

    it('blocks cross-tenant lead mutation (Org B cannot update Org A lead)', async () => {
      const leadA = await crmService.createLead(
        { name: 'Confidential Lead', phone: '+1 555 100 0003' },
        { id: 'usr-agent-a', name: 'Agent Alpha' },
        orgA,
      );

      await expect(
        crmService.updateLead(leadA.id, { name: 'Hacked Lead' }, { id: 'usr-agent-b' }, orgB),
      ).rejects.toThrow(NotFoundException);
    });

    it('blocks cross-tenant lead deletion (Org B cannot delete Org A lead)', async () => {
      const leadA = await crmService.createLead(
        { name: 'Lead to Delete', phone: '+1 555 100 0004' },
        { id: 'usr-agent-a', name: 'Agent Alpha' },
        orgA,
      );

      await expect(
        crmService.deleteLead(leadA.id, 'admin', orgB),
      ).rejects.toThrow(NotFoundException);
    });

    it('allows same phone number across DIFFERENT organizations without collision', async () => {
      const phone = '+1 555 999 8888';
      const leadA = await crmService.createLead({ name: 'Alpha Client', phone }, undefined, orgA);
      const leadB = await crmService.createLead({ name: 'Beta Client', phone }, undefined, orgB);

      expect(leadA.organizationId).toBe(orgA);
      expect(leadB.organizationId).toBe(orgB);
      expect(leadA.id).not.toBe(leadB.id);
    });

    it('rejects duplicate active phone number within the SAME organization', async () => {
      const phone = '+1 555 777 6666';
      await crmService.createLead({ name: 'First Lead', phone }, undefined, orgA);
      await expect(
        crmService.createLead({ name: 'Duplicate Lead', phone }, undefined, orgA),
      ).rejects.toThrow(ConflictException);
    });

    it('blocks assigning a lead to a user who is NOT a member of that organization', async () => {
      // usr-agent-b belongs to Org B, not Org A
      await expect(
        crmService.createLead(
          { name: 'Invalid Assignee', phone: '+1 555 444 3333', assignedUserId: 'usr-agent-b' },
          undefined,
          orgA,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('2. CRM Notes, Tags, and Follow-ups Isolation', () => {
    it('isolates tags per organization', async () => {
      const tagA = await crmService.createTag({ name: 'VIP Customer', color: '#ff0000' }, 'usr-agent-a', orgA);
      const tagB = await crmService.createTag({ name: 'VIP Customer', color: '#00ff00' }, 'usr-agent-b', orgB);

      expect(tagA.organizationId).toBe(orgA);
      expect(tagB.organizationId).toBe(orgB);
      expect(tagA.id).not.toBe(tagB.id);
    });

    it('blocks cross-tenant note access', async () => {
      const leadA = await crmService.createLead({ name: 'Lead Notes Test', phone: '+1 555 333 2222' }, undefined, orgA);
      await crmService.createNote(leadA.id, { content: 'Secret Deal Terms' }, { id: 'usr-agent-a' }, orgA);

      // Org B trying to read notes of leadA -> 404
      await expect(crmService.findLeadNotes(leadA.id, orgB)).rejects.toThrow(NotFoundException);
    });

    it('blocks cross-tenant followup access and mutation', async () => {
      const leadA = await crmService.createLead({ name: 'Lead Followup Test', phone: '+1 555 222 1111' }, undefined, orgA);
      const fuA = await crmService.createFollowup(
        { leadId: leadA.id, title: 'Call Client', dueAt: new Date().toISOString() },
        { id: 'usr-agent-a' },
        orgA,
      );

      expect(fuA.organizationId).toBe(orgA);
      // Org B attempts update on fuA -> 404
      await expect(
        crmService.updateFollowup(fuA.id, { title: 'Hijacked' }, { id: 'usr-agent-b' }, orgB),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('3. Reseller Hierarchy & Client Isolation', () => {
    it('allows reseller admin to create child clients under their own organization', async () => {
      const child = await orgService.createOrganization(
        { name: 'Reseller Child 1', slug: 'reseller-child-1' },
        { id: 'usr-reseller-admin', platformRole: PlatformRole.RESELLER_ADMIN, organizationId: resellerOrg },
      );

      expect(child.parentOrganizationId).toBe(resellerOrg);
      expect(child.type).toBe(OrganizationType.CLIENT);
    });

    it('enforces reseller maxClientOrganizations limit', async () => {
      // Reseller has maxClientOrganizations: 3
      // Create 3 clients
      for (let i = 1; i <= 3; i++) {
        await orgService.createOrganization(
          { name: `Child ${i}`, slug: `child-${i}` },
          { id: 'usr-reseller-admin', platformRole: PlatformRole.RESELLER_ADMIN, organizationId: resellerOrg },
        );
      }

      // 4th client creation exceeds limit -> 403 Forbidden
      await expect(
        orgService.createOrganization(
          { name: 'Child 4 Over Limit', slug: 'child-4-over' },
          { id: 'usr-reseller-admin', platformRole: PlatformRole.RESELLER_ADMIN, organizationId: resellerOrg },
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('4. Plan Feature & Limit Enforcement', () => {
    it('enforces plan maxUsers limit', async () => {
      // orgA has plan-basic (maxUsers = 2). Already has 1 member (usr-agent-a).
      // Add 2nd member -> succeeds
      await orgService.addMember(orgA, { email: 'agent2@alpha.com', fullName: 'Agent 2' });

      // Add 3rd member -> exceeds limit (2) -> 403 Forbidden
      await expect(
        orgService.addMember(orgA, { email: 'agent3@alpha.com', fullName: 'Agent 3' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('enforces feature gating based on plan', async () => {
      // orgA is on plan-basic (apiAccess = false, automationEnabled = false)
      await expect(
        planService.checkFeature(orgA, 'plan-basic', 'apiAccess'),
      ).rejects.toThrow(ForbiddenException);

      // orgB is on plan-pro (apiAccess = true, automationEnabled = true)
      await expect(
        planService.checkFeature(orgB, 'plan-pro', 'apiAccess'),
      ).resolves.toBeUndefined();
    });
  });

  describe('5. Workspace Switching & Context Validation', () => {
    it('allows a member to switch into their own active workspace', async () => {
      const res = await orgService.switchOrganization('usr-agent-a', orgA, PlatformRole.USER);
      expect(res.organization.id).toBe(orgA);
      expect(res.role).toBe(UserRole.AGENT);
    });

    it('blocks a user from switching into an organization they are NOT a member of', async () => {
      // usr-agent-a has no membership in orgB
      await expect(
        orgService.switchOrganization('usr-agent-a', orgB, PlatformRole.USER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows Super Admin to switch into ANY organization workspace', async () => {
      const res = await orgService.switchOrganization('usr-admin-1', orgA, PlatformRole.SUPER_ADMIN);
      expect(res.organization.id).toBe(orgA);
      expect(res.role).toBe(UserRole.ADMIN);
    });
  });
});
