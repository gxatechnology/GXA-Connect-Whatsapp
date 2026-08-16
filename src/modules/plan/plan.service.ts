import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan, PlanStatus } from './entities/plan.entity';
import { OrganizationLimitOverride } from './entities/organization-limit-override.entity';
import { CreatePlanDto, UpdatePlanDto, SetLimitOverrideDto } from './dto/plan.dto';
import { createLogger } from '../../common/services/logger.service';

export interface EffectiveOrganizationLimits {
  planId: string | null;
  planName: string | null;
  maxUsers: number | null;
  maxWhatsAppAccounts: number | null;
  maxContacts: number | null;
  maxMonthlyMessages: number | null;
  maxCampaignRecipients: number | null;
  maxClientOrganizations: number | null;
  apiAccess: boolean;
  crmEnabled: boolean;
  automationEnabled: boolean;
  reportsEnabled: boolean;
}

@Injectable()
export class PlanService {
  private readonly logger = createLogger('PlanService');

  constructor(
    @InjectRepository(Plan, 'main')
    private readonly planRepository: Repository<Plan>,
    @InjectRepository(OrganizationLimitOverride, 'main')
    private readonly overrideRepository: Repository<OrganizationLimitOverride>,
  ) {}

  async findAll(): Promise<Plan[]> {
    return this.planRepository.find({
      order: { createdAt: 'ASC' },
    });
  }

  async findById(id: string): Promise<Plan> {
    const plan = await this.planRepository.findOne({ where: { id } });
    if (!plan) {
      throw new NotFoundException(`Plan with ID "${id}" not found`);
    }
    return plan;
  }

  async create(dto: CreatePlanDto): Promise<Plan> {
    const existing = await this.planRepository.findOne({ where: { name: dto.name.trim() } });
    if (existing) {
      throw new ConflictException(`A plan with name "${dto.name}" already exists`);
    }

    const plan = this.planRepository.create({
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      status: PlanStatus.ACTIVE,
      isSystemPlan: false,
      maxUsers: dto.maxUsers ?? null,
      maxWhatsAppAccounts: dto.maxWhatsAppAccounts ?? null,
      maxContacts: dto.maxContacts ?? null,
      maxMonthlyMessages: dto.maxMonthlyMessages ?? null,
      maxCampaignRecipients: dto.maxCampaignRecipients ?? null,
      maxClientOrganizations: dto.maxClientOrganizations ?? null,
      apiAccess: dto.apiAccess ?? true,
      crmEnabled: dto.crmEnabled ?? true,
      automationEnabled: dto.automationEnabled ?? true,
      reportsEnabled: dto.reportsEnabled ?? true,
    });

    return this.planRepository.save(plan);
  }

  async update(id: string, dto: UpdatePlanDto): Promise<Plan> {
    const plan = await this.findById(id);

    if (dto.name !== undefined) plan.name = dto.name.trim();
    if (dto.description !== undefined) plan.description = dto.description ? dto.description.trim() : null;
    if (dto.status !== undefined) plan.status = dto.status;
    if (dto.maxUsers !== undefined) plan.maxUsers = dto.maxUsers;
    if (dto.maxWhatsAppAccounts !== undefined) plan.maxWhatsAppAccounts = dto.maxWhatsAppAccounts;
    if (dto.maxContacts !== undefined) plan.maxContacts = dto.maxContacts;
    if (dto.maxMonthlyMessages !== undefined) plan.maxMonthlyMessages = dto.maxMonthlyMessages;
    if (dto.maxCampaignRecipients !== undefined) plan.maxCampaignRecipients = dto.maxCampaignRecipients;
    if (dto.maxClientOrganizations !== undefined) plan.maxClientOrganizations = dto.maxClientOrganizations;
    if (dto.apiAccess !== undefined) plan.apiAccess = dto.apiAccess;
    if (dto.crmEnabled !== undefined) plan.crmEnabled = dto.crmEnabled;
    if (dto.automationEnabled !== undefined) plan.automationEnabled = dto.automationEnabled;
    if (dto.reportsEnabled !== undefined) plan.reportsEnabled = dto.reportsEnabled;

    return this.planRepository.save(plan);
  }

  async delete(id: string): Promise<{ success: boolean }> {
    const plan = await this.findById(id);
    if (plan.isSystemPlan) {
      throw new ForbiddenException('System plans cannot be deleted');
    }
    plan.status = PlanStatus.ARCHIVED;
    await this.planRepository.save(plan);
    return { success: true };
  }

  // ── Limit Overrides ───────────────────────────────────────────────────

  async getLimitOverride(organizationId: string): Promise<OrganizationLimitOverride | null> {
    return this.overrideRepository.findOne({ where: { organizationId } });
  }

  async setLimitOverride(organizationId: string, dto: SetLimitOverrideDto): Promise<OrganizationLimitOverride> {
    let override = await this.overrideRepository.findOne({ where: { organizationId } });
    if (!override) {
      override = this.overrideRepository.create({ organizationId });
    }

    if (dto.maxUsers !== undefined) override.maxUsers = dto.maxUsers;
    if (dto.maxWhatsAppAccounts !== undefined) override.maxWhatsAppAccounts = dto.maxWhatsAppAccounts;
    if (dto.maxContacts !== undefined) override.maxContacts = dto.maxContacts;
    if (dto.maxMonthlyMessages !== undefined) override.maxMonthlyMessages = dto.maxMonthlyMessages;
    if (dto.maxCampaignRecipients !== undefined) override.maxCampaignRecipients = dto.maxCampaignRecipients;
    if (dto.maxClientOrganizations !== undefined) override.maxClientOrganizations = dto.maxClientOrganizations;
    if (dto.apiAccess !== undefined) override.apiAccess = dto.apiAccess;
    if (dto.crmEnabled !== undefined) override.crmEnabled = dto.crmEnabled;
    if (dto.automationEnabled !== undefined) override.automationEnabled = dto.automationEnabled;
    if (dto.reportsEnabled !== undefined) override.reportsEnabled = dto.reportsEnabled;

    return this.overrideRepository.save(override);
  }

  // ── Effective Limits Resolution ───────────────────────────────────────

  async getEffectiveLimits(organizationId: string, planId?: string | null): Promise<EffectiveOrganizationLimits> {
    let plan: Plan | null = null;
    if (planId) {
      plan = await this.planRepository.findOne({ where: { id: planId } });
    }

    const override = await this.overrideRepository.findOne({ where: { organizationId } });

    return {
      planId: plan?.id || null,
      planName: plan?.name || 'Standard',
      maxUsers: override?.maxUsers !== undefined && override?.maxUsers !== null ? override.maxUsers : (plan?.maxUsers ?? null),
      maxWhatsAppAccounts: override?.maxWhatsAppAccounts !== undefined && override?.maxWhatsAppAccounts !== null ? override.maxWhatsAppAccounts : (plan?.maxWhatsAppAccounts ?? null),
      maxContacts: override?.maxContacts !== undefined && override?.maxContacts !== null ? override.maxContacts : (plan?.maxContacts ?? null),
      maxMonthlyMessages: override?.maxMonthlyMessages !== undefined && override?.maxMonthlyMessages !== null ? override.maxMonthlyMessages : (plan?.maxMonthlyMessages ?? null),
      maxCampaignRecipients: override?.maxCampaignRecipients !== undefined && override?.maxCampaignRecipients !== null ? override.maxCampaignRecipients : (plan?.maxCampaignRecipients ?? null),
      maxClientOrganizations: override?.maxClientOrganizations !== undefined && override?.maxClientOrganizations !== null ? override.maxClientOrganizations : (plan?.maxClientOrganizations ?? null),
      apiAccess: override?.apiAccess !== undefined && override?.apiAccess !== null ? override.apiAccess : (plan?.apiAccess ?? true),
      crmEnabled: override?.crmEnabled !== undefined && override?.crmEnabled !== null ? override.crmEnabled : (plan?.crmEnabled ?? true),
      automationEnabled: override?.automationEnabled !== undefined && override?.automationEnabled !== null ? override.automationEnabled : (plan?.automationEnabled ?? true),
      reportsEnabled: override?.reportsEnabled !== undefined && override?.reportsEnabled !== null ? override.reportsEnabled : (plan?.reportsEnabled ?? true),
    };
  }

  async checkLimit(
    organizationId: string,
    planId: string | null,
    limitKey: 'maxUsers' | 'maxWhatsAppAccounts' | 'maxContacts' | 'maxMonthlyMessages' | 'maxCampaignRecipients' | 'maxClientOrganizations',
    currentCount: number,
    increment = 1,
  ): Promise<void> {
    const limits = await this.getEffectiveLimits(organizationId, planId);
    const max = limits[limitKey];
    if (max !== null && max !== undefined) {
      if (currentCount + increment > max) {
        const labels: Record<string, string> = {
          maxUsers: 'User limit',
          maxWhatsAppAccounts: 'WhatsApp account limit',
          maxContacts: 'Contact limit',
          maxMonthlyMessages: 'Monthly message limit',
          maxCampaignRecipients: 'Campaign recipient limit',
          maxClientOrganizations: 'Client organization limit',
        };
        throw new ForbiddenException(`${labels[limitKey] || limitKey} reached (${max}). Upgrade plan or adjust limit.`);
      }
    }
  }

  async checkFeature(
    organizationId: string,
    planId: string | null,
    feature: 'apiAccess' | 'crmEnabled' | 'automationEnabled' | 'reportsEnabled',
  ): Promise<void> {
    const limits = await this.getEffectiveLimits(organizationId, planId);
    if (!limits[feature]) {
      const labels: Record<string, string> = {
        apiAccess: 'API access',
        crmEnabled: 'CRM module',
        automationEnabled: 'Automation suite',
        reportsEnabled: 'Analytics & reports',
      };
      throw new ForbiddenException(`${labels[feature]} is not enabled for your organization plan.`);
    }
  }
}
