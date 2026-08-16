import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { CrmLead, LeadStage, LeadStatus, LeadSource } from './entities/crm-lead.entity';
import { CrmNote } from './entities/crm-note.entity';
import { CrmTag } from './entities/crm-tag.entity';
import { CrmLeadTag } from './entities/crm-lead-tag.entity';
import { CrmFollowup, FollowupStatus } from './entities/crm-followup.entity';
import { CrmActivity, CrmActivityType } from './entities/crm-activity.entity';
import { MessageBatch } from '../message/entities/message-batch.entity';
import { User, UserStatus } from '../user/entities/user.entity';
import { OrganizationMember, MemberStatus } from '../organization/entities/organization-member.entity';
import { PlanService } from '../plan/plan.service';
import {
  CreateLeadDto,
  UpdateLeadDto,
  CreateNoteDto,
  CreateTagDto,
  CreateFollowupDto,
  UpdateFollowupDto,
  LeadQueryDto,
  FollowupQueryDto,
} from './dto/crm.dto';
import { createLogger } from '../../common/services/logger.service';

/**
 * Universal E.164-compatible phone normalizer.
 * Extracts pure numeric digits from direct international numbers or WhatsApp JIDs
 * without hardcoding or assuming any country prefix.
 */
export function normalizePhone(rawPhone?: string | null): string {
  if (!rawPhone) return '';
  const stripped = rawPhone.split('@')[0].replace(/\D/g, '');
  return stripped;
}

export interface LeadWithTags extends CrmLead {
  tags: CrmTag[];
  notesCount?: number;
  followupsCount?: number;
}

@Injectable()
export class CrmService {
  private readonly logger = createLogger('CrmService');

  constructor(
    @InjectRepository(CrmLead, 'data')
    private readonly leadRepository: Repository<CrmLead>,
    @InjectRepository(CrmNote, 'data')
    private readonly noteRepository: Repository<CrmNote>,
    @InjectRepository(CrmTag, 'data')
    private readonly tagRepository: Repository<CrmTag>,
    @InjectRepository(CrmLeadTag, 'data')
    private readonly leadTagRepository: Repository<CrmLeadTag>,
    @InjectRepository(CrmFollowup, 'data')
    private readonly followupRepository: Repository<CrmFollowup>,
    @InjectRepository(CrmActivity, 'data')
    private readonly activityRepository: Repository<CrmActivity>,
    @InjectRepository(MessageBatch, 'data')
    private readonly batchRepository: Repository<MessageBatch>,
    @InjectRepository(User, 'main')
    private readonly userRepository: Repository<User>,
    @InjectRepository(OrganizationMember, 'main')
    private readonly memberRepository: Repository<OrganizationMember>,
    private readonly planService: PlanService,
  ) {}

  /**
   * Validates that an assigned user exists, is active, and belongs to the specified organization.
   */
  async validateAssignedUser(userId: string | null | undefined, organizationId: string): Promise<void> {
    if (!userId) return;
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || user.status === UserStatus.DISABLED) {
      throw new BadRequestException(`Cannot assign to non-existent or deactivated user "${userId}"`);
    }

    // Ensure user has active membership in the same organization
    const member = await this.memberRepository.findOne({
      where: { userId, organizationId, status: MemberStatus.ACTIVE },
    });
    if (!member) {
      throw new BadRequestException(`User "${userId}" is not an active member of this organization workspace`);
    }
  }

  // ── Leads ─────────────────────────────────────────────────────────────

  async findLeads(query: LeadQueryDto, organizationId = 'org-platform-default'): Promise<{ leads: LeadWithTags[]; total: number }> {
    const qb = this.leadRepository.createQueryBuilder('lead');
    qb.where('lead.organizationId = :organizationId', { organizationId });

    if (query.status && query.status !== 'all') {
      qb.andWhere('lead.status = :status', { status: query.status });
    }

    if (query.stage && query.stage !== 'all') {
      qb.andWhere('lead.stage = :stage', { stage: query.stage });
    }

    if (query.source && query.source !== 'all') {
      qb.andWhere('lead.source = :source', { source: query.source });
    }

    if (query.assignedUserId) {
      qb.andWhere('lead.assignedUserId = :assignedUserId', { assignedUserId: query.assignedUserId });
    }

    if (query.search) {
      const term = `%${query.search.trim()}%`;
      const phoneDigits = query.search.replace(/\D/g, '');
      if (phoneDigits.length >= 3) {
        qb.andWhere('(lead.name LIKE :term OR lead.company LIKE :term OR lead.phone LIKE :phoneTerm)', {
          term,
          phoneTerm: `%${phoneDigits}%`,
        });
      } else {
        qb.andWhere('(lead.name LIKE :term OR lead.company LIKE :term OR lead.email LIKE :term)', { term });
      }
    }

    if (query.tagId) {
      qb.innerJoin(
        CrmLeadTag,
        'lt',
        'lt.leadId = lead.id AND lt.tagId = :filterTagId',
        { filterTagId: query.tagId },
      );
    }

    qb.orderBy('lead.createdAt', 'DESC');
    qb.skip(query.offset || 0);
    qb.take(query.limit || 50);

    const [rawLeads, total] = await qb.getManyAndCount();

    if (rawLeads.length === 0) {
      return { leads: [], total: 0 };
    }

    // Attach tags in batch
    const leadIds = rawLeads.map(l => l.id);
    const leadTags = await this.leadTagRepository.find({
      where: { leadId: In(leadIds) },
    });

    const tagIds = Array.from(new Set(leadTags.map(lt => lt.tagId)));
    const allTags = tagIds.length > 0 ? await this.tagRepository.find({ where: { id: In(tagIds) } }) : [];
    const tagMap = new Map(allTags.map(t => [t.id, t]));

    const leadTagsMap = new Map<string, CrmTag[]>();
    for (const lt of leadTags) {
      const tag = tagMap.get(lt.tagId);
      if (tag) {
        const arr = leadTagsMap.get(lt.leadId) || [];
        arr.push(tag);
        leadTagsMap.set(lt.leadId, arr);
      }
    }

    const leads: LeadWithTags[] = rawLeads.map(lead => ({
      ...lead,
      tags: leadTagsMap.get(lead.id) || [],
    }));

    return { leads, total };
  }

  async findLeadById(id: string, organizationId = 'org-platform-default'): Promise<LeadWithTags & { notes: CrmNote[]; followups: CrmFollowup[] }> {
    const lead = await this.leadRepository.findOne({ where: { id, organizationId } });
    if (!lead) {
      throw new NotFoundException(`Lead with ID "${id}" not found`);
    }

    const leadTags = await this.leadTagRepository.find({ where: { leadId: id } });
    const tagIds = leadTags.map(lt => lt.tagId);
    const tags = tagIds.length > 0 ? await this.tagRepository.find({ where: { id: In(tagIds) } }) : [];

    const notes = await this.noteRepository.find({
      where: { leadId: id, organizationId },
      order: { createdAt: 'DESC' },
      take: 20,
    });

    const followups = await this.followupRepository.find({
      where: { leadId: id, organizationId },
      order: { dueAt: 'ASC' },
    });

    return {
      ...lead,
      tags,
      notes,
      followups,
    };
  }

  async findLeadByPhone(phone: string, organizationId = 'org-platform-default', sessionId?: string): Promise<LeadWithTags | null> {
    const normalized = normalizePhone(phone);
    if (!normalized) return null;

    const query: Record<string, unknown> = { phone: normalized, organizationId, status: LeadStatus.ACTIVE };
    if (sessionId) query.sessionId = sessionId;

    let lead = await this.leadRepository.findOne({ where: query });
    if (!lead) {
      lead = await this.leadRepository.findOne({
        where: { phone: normalized, organizationId, status: LeadStatus.ACTIVE },
      });
    }

    if (!lead) return null;

    const leadTags = await this.leadTagRepository.find({ where: { leadId: lead.id } });
    const tagIds = leadTags.map(lt => lt.tagId);
    const tags = tagIds.length > 0 ? await this.tagRepository.find({ where: { id: In(tagIds) } }) : [];

    return { ...lead, tags };
  }

  async createLead(
    dto: CreateLeadDto,
    actor?: { id?: string; name?: string },
    organizationId = 'org-platform-default',
  ): Promise<LeadWithTags> {
    const normalized = normalizePhone(dto.phone);
    if (!normalized) {
      throw new ConflictException('Valid phone number with international digits is required');
    }

    // Validate assigned user within tenant
    if (dto.assignedUserId) {
      await this.validateAssignedUser(dto.assignedUserId, organizationId);
    }

    // Check duplicate active lead within tenant
    const existing = await this.leadRepository.findOne({
      where: { phone: normalized, organizationId, status: LeadStatus.ACTIVE },
    });
    if (existing) {
      throw new ConflictException(`An active lead with phone "${normalized}" already exists (${existing.name})`);
    }

    const lead = this.leadRepository.create({
      organizationId,
      name: dto.name.trim(),
      phone: normalized,
      contactId: dto.contactId || (dto.phone.includes('@') ? dto.phone : `${normalized}@c.us`),
      sessionId: dto.sessionId || null,
      email: dto.email ? dto.email.trim().toLowerCase() : null,
      company: dto.company ? dto.company.trim() : null,
      source: dto.source || LeadSource.MANUAL,
      stage: dto.stage || LeadStage.NEW,
      assignedUserId: dto.assignedUserId || null,
      status: LeadStatus.ACTIVE,
      lastActivityAt: new Date(),
    });

    const saved = await this.leadRepository.save(lead);

    // Save initial note if provided
    if (dto.notes && dto.notes.trim()) {
      await this.noteRepository.save(
        this.noteRepository.create({
          organizationId,
          leadId: saved.id,
          content: dto.notes.trim(),
          authorUserId: actor?.id || null,
          authorName: actor?.name || 'System',
        }),
      );
    }

    // Process initial tags
    const attachedTags: CrmTag[] = [];
    if (dto.tags && dto.tags.length > 0) {
      for (const tagInput of dto.tags) {
        let tag = await this.tagRepository.findOne({ where: { id: tagInput, organizationId } });
        if (!tag) {
          tag = await this.tagRepository.findOne({ where: { name: tagInput.trim(), organizationId } });
        }
        if (!tag) {
          tag = await this.tagRepository.save(
            this.tagRepository.create({
              organizationId,
              name: tagInput.trim(),
              color: '#0B4DBB',
              createdBy: actor?.id || null,
            }),
          );
        }
        await this.leadTagRepository.save(
          this.leadTagRepository.create({
            leadId: saved.id,
            tagId: tag.id,
          }),
        );
        attachedTags.push(tag);
      }
    }

    // Log Activity
    await this.logActivity(saved.id, organizationId, CrmActivityType.LEAD_CREATED, actor, {
      name: saved.name,
      stage: saved.stage,
      source: saved.source,
    });

    return { ...saved, tags: attachedTags };
  }

  async updateLead(
    id: string,
    dto: UpdateLeadDto,
    actor?: { id?: string; name?: string },
    organizationId = 'org-platform-default',
  ): Promise<LeadWithTags> {
    const lead = await this.leadRepository.findOne({ where: { id, organizationId } });
    if (!lead) {
      throw new NotFoundException(`Lead with ID "${id}" not found`);
    }

    // Validate assigned user within tenant
    if (dto.assignedUserId !== undefined && dto.assignedUserId !== null) {
      await this.validateAssignedUser(dto.assignedUserId, organizationId);
    }

    const previousStage = lead.stage;
    const previousAssigned = lead.assignedUserId;

    if (dto.name !== undefined) lead.name = dto.name.trim();
    if (dto.phone !== undefined) lead.phone = normalizePhone(dto.phone);
    if (dto.email !== undefined) lead.email = dto.email ? dto.email.trim().toLowerCase() : null;
    if (dto.company !== undefined) lead.company = dto.company ? dto.company.trim() : null;
    if (dto.source !== undefined) lead.source = dto.source;
    if (dto.stage !== undefined) lead.stage = dto.stage;
    if (dto.assignedUserId !== undefined) lead.assignedUserId = dto.assignedUserId;
    if (dto.status !== undefined) lead.status = dto.status;

    lead.lastActivityAt = new Date();
    const saved = await this.leadRepository.save(lead);

    // Record stage transition activity
    if (dto.stage && dto.stage !== previousStage) {
      await this.logActivity(saved.id, organizationId, CrmActivityType.STAGE_CHANGED, actor, {
        from: previousStage,
        to: dto.stage,
      });
    }

    // Record assignment change activity
    if (dto.assignedUserId !== undefined && dto.assignedUserId !== previousAssigned) {
      await this.logActivity(saved.id, organizationId, CrmActivityType.ASSIGNED_USER_CHANGED, actor, {
        fromUserId: previousAssigned,
        toUserId: dto.assignedUserId,
      });
    }

    const leadTags = await this.leadTagRepository.find({ where: { leadId: saved.id } });
    const tagIds = leadTags.map(lt => lt.tagId);
    const tags = tagIds.length > 0 ? await this.tagRepository.find({ where: { id: In(tagIds) } }) : [];

    return { ...saved, tags };
  }

  async deleteLead(id: string, actorRole?: string, organizationId = 'org-platform-default'): Promise<{ success: boolean }> {
    if (actorRole && actorRole !== 'admin' && actorRole !== 'manager') {
      throw new ForbiddenException('Only Administrators and Managers can archive leads');
    }

    const lead = await this.leadRepository.findOne({ where: { id, organizationId } });
    if (!lead) {
      throw new NotFoundException(`Lead with ID "${id}" not found`);
    }

    lead.status = LeadStatus.ARCHIVED;
    await this.leadRepository.save(lead);
    return { success: true };
  }

  // ── Tags ──────────────────────────────────────────────────────────────

  async findTags(organizationId = 'org-platform-default'): Promise<Array<CrmTag & { leadCount: number }>> {
    const tags = await this.tagRepository.find({ where: { organizationId }, order: { name: 'ASC' } });
    if (tags.length === 0) return [];

    const tagIds = tags.map(t => t.id);
    const counts = await this.leadTagRepository
      .createQueryBuilder('lt')
      .select('lt.tagId', 'tagId')
      .addSelect('COUNT(lt.id)', 'count')
      .where('lt.tagId IN (:...tagIds)', { tagIds })
      .groupBy('lt.tagId')
      .getRawMany<{ tagId: string; count: string }>();

    const countMap = new Map(counts.map(c => [c.tagId, parseInt(c.count, 10) || 0]));

    return tags.map(tag => ({
      ...tag,
      leadCount: countMap.get(tag.id) || 0,
    }));
  }

  async createTag(dto: CreateTagDto, actorUserId?: string, organizationId = 'org-platform-default'): Promise<CrmTag> {
    const name = dto.name.trim();
    const existing = await this.tagRepository.findOne({ where: { name, organizationId } });
    if (existing) {
      return existing;
    }

    const tag = this.tagRepository.create({
      organizationId,
      name,
      color: dto.color || '#0B4DBB',
      createdBy: actorUserId || null,
    });

    return this.tagRepository.save(tag);
  }

  async deleteTag(tagId: string, organizationId = 'org-platform-default'): Promise<{ success: boolean }> {
    const tag = await this.tagRepository.findOne({ where: { id: tagId, organizationId } });
    if (!tag) throw new NotFoundException('Tag not found');

    await this.leadTagRepository.delete({ tagId });
    await this.tagRepository.delete({ id: tagId });
    return { success: true };
  }

  async addTagToLead(leadId: string, tagId: string, actor?: { id?: string; name?: string }, organizationId = 'org-platform-default'): Promise<void> {
    const lead = await this.leadRepository.findOne({ where: { id: leadId, organizationId } });
    if (!lead) throw new NotFoundException('Lead not found');

    const tag = await this.tagRepository.findOne({ where: { id: tagId, organizationId } });
    if (!tag) throw new NotFoundException('Tag not found');

    const existing = await this.leadTagRepository.findOne({ where: { leadId, tagId } });
    if (!existing) {
      await this.leadTagRepository.save(this.leadTagRepository.create({ leadId, tagId }));
      await this.logActivity(leadId, organizationId, CrmActivityType.TAG_ADDED, actor, { tagName: tag.name, tagId: tag.id });
      await this.leadRepository.update(leadId, { lastActivityAt: new Date() });
    }
  }

  async removeTagFromLead(leadId: string, tagId: string, actor?: { id?: string; name?: string }, organizationId = 'org-platform-default'): Promise<void> {
    const lead = await this.leadRepository.findOne({ where: { id: leadId, organizationId } });
    if (!lead) throw new NotFoundException('Lead not found');

    const tag = await this.tagRepository.findOne({ where: { id: tagId, organizationId } });
    await this.leadTagRepository.delete({ leadId, tagId });
    if (tag) {
      await this.logActivity(leadId, organizationId, CrmActivityType.TAG_REMOVED, actor, { tagName: tag.name, tagId: tag.id });
      await this.leadRepository.update(leadId, { lastActivityAt: new Date() });
    }
  }

  // ── Notes ─────────────────────────────────────────────────────────────

  async findLeadNotes(leadId: string, organizationId = 'org-platform-default'): Promise<CrmNote[]> {
    const lead = await this.leadRepository.findOne({ where: { id: leadId, organizationId } });
    if (!lead) throw new NotFoundException('Lead not found');

    return this.noteRepository.find({
      where: { leadId, organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  async createNote(leadId: string, dto: CreateNoteDto, actor?: { id?: string; name?: string }, organizationId = 'org-platform-default'): Promise<CrmNote> {
    const lead = await this.leadRepository.findOne({ where: { id: leadId, organizationId } });
    if (!lead) throw new NotFoundException('Lead not found');

    const note = this.noteRepository.create({
      organizationId,
      leadId,
      content: dto.content.trim(),
      authorUserId: actor?.id || null,
      authorName: actor?.name || 'User',
    });

    const saved = await this.noteRepository.save(note);
    await this.leadRepository.update(leadId, { lastActivityAt: new Date() });
    await this.logActivity(leadId, organizationId, CrmActivityType.NOTE_ADDED, actor, { noteId: saved.id });
    return saved;
  }

  async deleteNote(noteId: string, actor?: { id?: string }, role?: string, organizationId = 'org-platform-default'): Promise<{ success: boolean }> {
    const note = await this.noteRepository.findOne({ where: { id: noteId, organizationId } });
    if (!note) {
      throw new NotFoundException(`Note with ID "${noteId}" not found`);
    }

    const isManagerOrAdmin = role === 'admin' || role === 'manager' || !actor?.id;
    const isAuthor = note.authorUserId && actor?.id && note.authorUserId === actor.id;

    if (!isManagerOrAdmin && !isAuthor) {
      throw new ForbiddenException('You do not have permission to delete this note (author only)');
    }

    await this.noteRepository.delete({ id: noteId });
    return { success: true };
  }

  // ── Follow-ups ────────────────────────────────────────────────────────

  async findFollowups(query: FollowupQueryDto, organizationId = 'org-platform-default'): Promise<{ followups: Array<CrmFollowup & { lead?: CrmLead }>; total: number }> {
    const qb = this.followupRepository.createQueryBuilder('fu');
    qb.where('fu.organizationId = :organizationId', { organizationId });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    if (query.leadId) {
      qb.andWhere('fu.leadId = :leadId', { leadId: query.leadId });
    }

    if (query.assignedUserId) {
      qb.andWhere('fu.assignedUserId = :assignedUserId', { assignedUserId: query.assignedUserId });
    }

    if (query.view === 'today') {
      qb.andWhere('fu.status = :pendingStatus', { pendingStatus: FollowupStatus.PENDING });
      qb.andWhere('fu.dueAt >= :startOfToday AND fu.dueAt <= :endOfToday', { startOfToday, endOfToday });
    } else if (query.view === 'upcoming') {
      qb.andWhere('fu.status = :pendingStatus', { pendingStatus: FollowupStatus.PENDING });
      qb.andWhere('fu.dueAt > :endOfToday', { endOfToday });
    } else if (query.view === 'overdue') {
      qb.andWhere('fu.status = :pendingStatus', { pendingStatus: FollowupStatus.PENDING });
      qb.andWhere('fu.dueAt < :startOfToday', { startOfToday });
    } else if (query.view === 'completed') {
      qb.andWhere('fu.status = :completedStatus', { completedStatus: FollowupStatus.COMPLETED });
    }

    qb.orderBy('fu.dueAt', 'ASC');
    qb.skip(query.offset || 0);
    qb.take(query.limit || 50);

    const [rawFollowups, total] = await qb.getManyAndCount();

    if (rawFollowups.length === 0) {
      return { followups: [], total: 0 };
    }

    const leadIds = Array.from(new Set(rawFollowups.map(f => f.leadId)));
    const leads = leadIds.length > 0 ? await this.leadRepository.find({ where: { id: In(leadIds), organizationId } }) : [];
    const leadMap = new Map(leads.map(l => [l.id, l]));

    const followups = rawFollowups.map(f => ({
      ...f,
      lead: leadMap.get(f.leadId),
    }));

    return { followups, total };
  }

  async createFollowup(dto: CreateFollowupDto, actor?: { id?: string; name?: string }, organizationId = 'org-platform-default'): Promise<CrmFollowup> {
    const lead = await this.leadRepository.findOne({ where: { id: dto.leadId, organizationId } });
    if (!lead) throw new NotFoundException('Lead not found');

    const targetUserId = dto.assignedUserId || lead.assignedUserId || null;
    if (targetUserId) {
      await this.validateAssignedUser(targetUserId, organizationId);
    }

    const dueAt = new Date(dto.dueAt);
    const followup = this.followupRepository.create({
      organizationId,
      leadId: dto.leadId,
      title: dto.title.trim(),
      notes: dto.notes ? dto.notes.trim() : null,
      type: dto.type || 'General',
      dueAt,
      status: FollowupStatus.PENDING,
      assignedUserId: targetUserId,
      createdBy: actor?.id || null,
    });

    const saved = await this.followupRepository.save(followup);
    await this.refreshLeadNextFollowup(dto.leadId, organizationId);
    await this.logActivity(dto.leadId, organizationId, CrmActivityType.FOLLOWUP_CREATED, actor, {
      title: saved.title,
      dueAt: saved.dueAt,
      type: saved.type,
    });
    return saved;
  }

  async updateFollowup(id: string, dto: UpdateFollowupDto, actor?: { id?: string; name?: string }, organizationId = 'org-platform-default'): Promise<CrmFollowup> {
    const followup = await this.followupRepository.findOne({ where: { id, organizationId } });
    if (!followup) throw new NotFoundException(`Follow-up with ID "${id}" not found`);

    if (dto.assignedUserId !== undefined && dto.assignedUserId !== null) {
      await this.validateAssignedUser(dto.assignedUserId, organizationId);
      followup.assignedUserId = dto.assignedUserId;
    }

    if (dto.title !== undefined) followup.title = dto.title.trim();
    if (dto.notes !== undefined) followup.notes = dto.notes ? dto.notes.trim() : null;
    if (dto.type !== undefined) followup.type = dto.type;
    if (dto.dueAt !== undefined) followup.dueAt = new Date(dto.dueAt);

    if (dto.status !== undefined) {
      followup.status = dto.status;
      if (dto.status === FollowupStatus.COMPLETED) {
        followup.completedAt = new Date();
        await this.logActivity(followup.leadId, organizationId, CrmActivityType.FOLLOWUP_COMPLETED, actor, {
          title: followup.title,
        });
      } else {
        followup.completedAt = null;
      }
    }

    const saved = await this.followupRepository.save(followup);
    await this.refreshLeadNextFollowup(followup.leadId, organizationId);
    return saved;
  }

  async deleteFollowup(id: string, actor?: { id?: string }, role?: string, organizationId = 'org-platform-default'): Promise<{ success: boolean }> {
    const followup = await this.followupRepository.findOne({ where: { id, organizationId } });
    if (!followup) {
      return { success: true };
    }

    const isManagerOrAdmin = role === 'admin' || role === 'manager' || !actor?.id;
    const isCreatorOrAssignee =
      (followup.createdBy && actor?.id && followup.createdBy === actor.id) ||
      (followup.assignedUserId && actor?.id && followup.assignedUserId === actor.id);

    if (!isManagerOrAdmin && !isCreatorOrAssignee) {
      throw new ForbiddenException('You do not have permission to delete this follow-up');
    }

    const leadId = followup.leadId;
    await this.followupRepository.delete({ id });
    await this.refreshLeadNextFollowup(leadId, organizationId);
    return { success: true };
  }

  private async refreshLeadNextFollowup(leadId: string, organizationId: string): Promise<void> {
    const earliest = await this.followupRepository.findOne({
      where: { leadId, organizationId, status: FollowupStatus.PENDING },
      order: { dueAt: 'ASC' },
    });

    await this.leadRepository.update(
      { id: leadId, organizationId },
      {
        nextFollowUpAt: earliest ? earliest.dueAt : null,
        lastActivityAt: new Date(),
      },
    );
  }

  // ── Activity Timeline ─────────────────────────────────────────────────

  async findLeadActivity(leadId: string, organizationId = 'org-platform-default'): Promise<CrmActivity[]> {
    const lead = await this.leadRepository.findOne({ where: { id: leadId, organizationId } });
    if (!lead) throw new NotFoundException('Lead not found');

    return this.activityRepository.find({
      where: { leadId, organizationId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  private async logActivity(
    leadId: string,
    organizationId: string,
    type: CrmActivityType | string,
    actor?: { id?: string; name?: string },
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.activityRepository.save(
        this.activityRepository.create({
          organizationId,
          leadId,
          actorUserId: actor?.id || null,
          actorName: actor?.name || 'System',
          type,
          metadata: metadata || null,
        }),
      );
    } catch (err) {
      this.logger.warn('Failed to log CRM activity', { error: String(err) });
    }
  }

  // ── Campaign History for Lead ─────────────────────────────────────────

  async findLeadCampaignHistory(leadId: string, organizationId = 'org-platform-default'): Promise<Array<{
    batchId: string;
    campaignName: string;
    sessionId: string;
    status: string;
    sentAt: Date | null;
    messageId?: string;
    error?: string;
  }>> {
    const lead = await this.leadRepository.findOne({ where: { id: leadId, organizationId } });
    if (!lead) throw new NotFoundException('Lead not found');

    const phone = normalizePhone(lead.phone);
    const targetChatId1 = `${phone}@c.us`;
    const targetChatId2 = `${phone}@s.whatsapp.net`;

    const batches = await this.batchRepository.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
      take: 50,
    });

    const history: Array<{
      batchId: string;
      campaignName: string;
      sessionId: string;
      status: string;
      sentAt: Date | null;
      messageId?: string;
      error?: string;
    }> = [];

    for (const batch of batches) {
      const results = batch.results || [];
      const match = results.find(
        r =>
          r.chatId === targetChatId1 ||
          r.chatId === targetChatId2 ||
          normalizePhone(r.chatId) === phone,
      );

      if (match) {
        history.push({
          batchId: batch.batchId,
          campaignName: batch.campaignName || `Batch ${batch.batchId.substring(0, 8)}`,
          sessionId: batch.sessionId,
          status: match.status,
          sentAt: match.sentAt ? new Date(match.sentAt) : batch.createdAt,
          messageId: match.messageId,
          error: match.error?.message,
        });
      }
    }

    return history;
  }
}
