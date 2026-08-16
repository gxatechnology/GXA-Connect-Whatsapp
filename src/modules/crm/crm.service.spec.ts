import { ConflictException, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CrmService, normalizePhone } from './crm.service';
import { LeadStage, LeadStatus, LeadSource } from './entities/crm-lead.entity';
import { UserStatus } from '../user/entities/user.entity';

describe('CRM Core & Authorization Suite (CrmService)', () => {
  let crmService: CrmService;
  let mockLeadRepo: any;
  let mockNoteRepo: any;
  let mockTagRepo: any;
  let mockLeadTagRepo: any;
  let mockFollowupRepo: any;
  let mockActivityRepo: any;
  let mockBatchRepo: any;
  let mockUserRepo: any;

  beforeEach(() => {
    mockLeadRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn((entity) => Promise.resolve({ id: 'lead-123', ...entity })),
      create: jest.fn((entity) => ({ ...entity })),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    mockNoteRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn((entity) => Promise.resolve({ id: 'note-123', ...entity })),
      create: jest.fn((entity) => ({ ...entity })),
      delete: jest.fn(),
    };
    mockTagRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn((entity) => Promise.resolve({ id: 'tag-123', ...entity })),
      create: jest.fn((entity) => ({ ...entity })),
      delete: jest.fn(),
    };
    mockLeadTagRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn((entity) => ({ ...entity })),
      delete: jest.fn(),
    };
    mockFollowupRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn((entity) => Promise.resolve({ id: 'fu-123', ...entity })),
      create: jest.fn((entity) => ({ ...entity })),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    mockActivityRepo = {
      save: jest.fn(),
      create: jest.fn((entity) => ({ ...entity })),
      find: jest.fn(),
    };
    mockBatchRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    mockUserRepo = {
      findOne: jest.fn(),
    };
    const mockMemberRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'mem-1', status: 'active' }),
      count: jest.fn().mockResolvedValue(1),
    };
    const mockPlanService = {
      checkLimit: jest.fn().mockResolvedValue(undefined),
      checkFeature: jest.fn().mockResolvedValue(undefined),
    };

    crmService = new CrmService(
      mockLeadRepo,
      mockNoteRepo,
      mockTagRepo,
      mockLeadTagRepo,
      mockFollowupRepo,
      mockActivityRepo,
      mockBatchRepo,
      mockUserRepo,
      mockMemberRepo as any,
      mockPlanService as any,
    );
  });

  describe('Phone Normalization (E.164-compatible)', () => {
    it('normalizes international formats without assuming a country code', () => {
      expect(normalizePhone('+1 (555) 234-5678')).toBe('15552345678');
      expect(normalizePhone('15552345678@c.us')).toBe('15552345678');
      expect(normalizePhone('+44 7911 123456')).toBe('447911123456');
      expect(normalizePhone('447911123456@s.whatsapp.net')).toBe('447911123456');
      expect(normalizePhone('+91 98765 43210')).toBe('919876543210');
      expect(normalizePhone('919876543210')).toBe('919876543210');
      expect(normalizePhone('+971 50 123 4567')).toBe('971501234567');
      expect(normalizePhone('')).toBe('');
      expect(normalizePhone(null)).toBe('');
    });
  });

  describe('Duplicate Lead Prevention', () => {
    it('prevents creating duplicate active lead with matching normalized phone', async () => {
      mockLeadRepo.findOne.mockResolvedValue({
        id: 'lead-existing',
        name: 'Existing Customer',
        phone: '15551234567',
        status: LeadStatus.ACTIVE,
      });

      await expect(
        crmService.createLead({
          name: 'Duplicate Lead',
          phone: '+1 (555) 123-4567',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates lead successfully when phone is unique', async () => {
      mockLeadRepo.findOne.mockResolvedValue(null);

      const lead = await crmService.createLead(
        {
          name: 'Acme Corp',
          phone: '+1 555-987-6543',
          company: 'Acme',
        },
        { id: 'usr-admin', name: 'Admin' },
      );

      expect(lead.phone).toBe('15559876543');
      expect(mockLeadRepo.save).toHaveBeenCalled();
      expect(mockActivityRepo.save).toHaveBeenCalled();
    });
  });

  describe('Assignment Validation', () => {
    it('rejects assigning lead to nonexistent user', async () => {
      mockLeadRepo.findOne.mockResolvedValue(null);
      mockUserRepo.findOne.mockResolvedValue(null); // User not found

      await expect(
        crmService.createLead({
          name: 'Lead',
          phone: '+1 555 111 2222',
          assignedUserId: 'nonexistent-user',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects assigning lead to disabled user', async () => {
      mockLeadRepo.findOne.mockResolvedValue(null);
      mockUserRepo.findOne.mockResolvedValue({
        id: 'usr-disabled',
        status: UserStatus.DISABLED,
      });

      await expect(
        crmService.createLead({
          name: 'Lead',
          phone: '+1 555 111 2222',
          assignedUserId: 'usr-disabled',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Record-Level IDOR & Deletion Permissions', () => {
    it('allows note author to delete their own note', async () => {
      mockNoteRepo.findOne.mockResolvedValue({
        id: 'note-1',
        leadId: 'lead-1',
        authorUserId: 'usr-agent-1',
      });

      const res = await crmService.deleteNote('note-1', { id: 'usr-agent-1' }, 'agent');
      expect(res.success).toBe(true);
      expect(mockNoteRepo.delete).toHaveBeenCalledWith({ id: 'note-1' });
    });

    it('prevents other agents from deleting someone elses note', async () => {
      mockNoteRepo.findOne.mockResolvedValue({
        id: 'note-1',
        leadId: 'lead-1',
        authorUserId: 'usr-agent-1',
      });

      await expect(
        crmService.deleteNote('note-1', { id: 'usr-agent-2' }, 'agent'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows Manager or Admin to delete any note', async () => {
      mockNoteRepo.findOne.mockResolvedValue({
        id: 'note-1',
        leadId: 'lead-1',
        authorUserId: 'usr-agent-1',
      });

      const resManager = await crmService.deleteNote('note-1', { id: 'usr-manager' }, 'manager');
      expect(resManager.success).toBe(true);

      const resAdmin = await crmService.deleteNote('note-1', { id: 'usr-admin' }, 'admin');
      expect(resAdmin.success).toBe(true);
    });

    it('only allows Admins and Managers to delete / archive leads', async () => {
      mockLeadRepo.findOne.mockResolvedValue({
        id: 'lead-1',
        status: LeadStatus.ACTIVE,
      });

      await expect(
        crmService.deleteLead('lead-1', 'agent'),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        crmService.deleteLead('lead-1', 'viewer'),
      ).rejects.toThrow(ForbiddenException);

      const res = await crmService.deleteLead('lead-1', 'manager');
      expect(res.success).toBe(true);
    });
  });
});
