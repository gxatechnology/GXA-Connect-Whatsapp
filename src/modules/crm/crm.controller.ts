import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import { CrmService, LeadWithTags } from './crm.service';
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
import { RequireRole, CurrentApiKey } from '../auth/decorators/auth.decorators';
import { ApiKey, ApiKeyRole } from '../auth/entities/api-key.entity';
import { User } from '../user/entities/user.entity';
import { CrmLead } from './entities/crm-lead.entity';
import { CrmNote } from './entities/crm-note.entity';
import { CrmTag } from './entities/crm-tag.entity';
import { CrmFollowup } from './entities/crm-followup.entity';
import { CrmActivity } from './entities/crm-activity.entity';

@ApiTags('crm')
@Controller('crm')
export class CrmController {
  constructor(private readonly crmService: CrmService) {}

  private getActor(req: Request): { id?: string; name?: string } {
    const user = (req as Request & { user?: User }).user;
    if (user) {
      return { id: user.id, name: user.fullName };
    }
    const apiKey = (req as Request & { apiKey?: { id: string; name: string } }).apiKey;
    if (apiKey) {
      return { id: apiKey.id, name: apiKey.name };
    }
    return { name: 'System' };
  }

  private getActorRole(req: Request): string {
    const user = (req as Request & { user?: User }).user;
    if (user) return user.role;
    const apiKey = (req as Request & { apiKey?: { role: string } }).apiKey;
    if (apiKey) return apiKey.role;
    return 'admin';
  }

  private getOrgId(req: Request): string {
    const orgId = (req as Request & { organizationId?: string }).organizationId;
    return orgId || 'org-platform-default';
  }

  // ── Leads ─────────────────────────────────────────────────────────────

  @Get('leads')
  @RequireRole(ApiKeyRole.VIEWER)
  @ApiOperation({ summary: 'List CRM leads with query filters' })
  async findLeads(
    @Query() query: LeadQueryDto,
    @Req() req: Request,
  ): Promise<{ leads: LeadWithTags[]; total: number }> {
    return this.crmService.findLeads(query, this.getOrgId(req));
  }

  @Get('leads/by-phone')
  @RequireRole(ApiKeyRole.VIEWER)
  @ApiOperation({ summary: 'Lookup CRM lead by phone number' })
  async findLeadByPhone(
    @CurrentApiKey() apiKey: ApiKey | undefined,
    @Query('phone') phone: string,
    @Query('sessionId') sessionId: string | undefined,
    @Req() req: Request,
  ): Promise<LeadWithTags | null> {
    return this.crmService.findLeadByPhone(phone, this.getOrgId(req), sessionId);
  }

  @Get('leads/:id')
  @RequireRole(ApiKeyRole.VIEWER)
  @ApiOperation({ summary: 'Get lead details with tags, notes, and followups' })
  async findLeadById(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<LeadWithTags & { notes: CrmNote[]; followups: CrmFollowup[] }> {
    return this.crmService.findLeadById(id, this.getOrgId(req));
  }

  @Post('leads')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Create a new CRM lead' })
  @ApiResponse({ status: 201, description: 'Lead created' })
  async createLead(
    @Body() dto: CreateLeadDto,
    @Req() req: Request,
  ): Promise<LeadWithTags> {
    const actor = this.getActor(req);
    return this.crmService.createLead(dto, actor, this.getOrgId(req));
  }

  @Patch('leads/:id')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Update CRM lead attributes or stage' })
  async updateLead(
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
    @Req() req: Request,
  ): Promise<LeadWithTags> {
    const actor = this.getActor(req);
    return this.crmService.updateLead(id, dto, actor, this.getOrgId(req));
  }

  @Delete('leads/:id')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Archive CRM lead (Admin / Manager only)' })
  async deleteLead(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ success: boolean }> {
    const role = this.getActorRole(req);
    return this.crmService.deleteLead(id, role, this.getOrgId(req));
  }

  // ── Tags ──────────────────────────────────────────────────────────────

  @Get('tags')
  @RequireRole(ApiKeyRole.VIEWER)
  @ApiOperation({ summary: 'List all CRM tags with usage count' })
  async findTags(@Req() req: Request): Promise<Array<CrmTag & { leadCount: number }>> {
    return this.crmService.findTags(this.getOrgId(req));
  }

  @Post('tags')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Create a new CRM tag' })
  async createTag(
    @Body() dto: CreateTagDto,
    @Req() req: Request,
  ): Promise<CrmTag> {
    const actor = this.getActor(req);
    return this.crmService.createTag(dto, actor.id, this.getOrgId(req));
  }

  @Delete('tags/:id')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Delete a CRM tag' })
  async deleteTag(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ success: boolean }> {
    return this.crmService.deleteTag(id, this.getOrgId(req));
  }

  @Post('leads/:id/tags')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Attach tag to lead' })
  async addTagToLead(
    @Param('id') leadId: string,
    @Body('tagId') tagId: string,
    @Req() req: Request,
  ): Promise<{ success: boolean }> {
    const actor = this.getActor(req);
    await this.crmService.addTagToLead(leadId, tagId, actor, this.getOrgId(req));
    return { success: true };
  }

  @Delete('leads/:id/tags/:tagId')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Remove tag from lead' })
  async removeTagFromLead(
    @Param('id') leadId: string,
    @Param('tagId') tagId: string,
    @Req() req: Request,
  ): Promise<{ success: boolean }> {
    const actor = this.getActor(req);
    await this.crmService.removeTagFromLead(leadId, tagId, actor, this.getOrgId(req));
    return { success: true };
  }

  // ── Notes ─────────────────────────────────────────────────────────────

  @Get('leads/:id/notes')
  @RequireRole(ApiKeyRole.VIEWER)
  @ApiOperation({ summary: 'Get internal notes for lead' })
  async findLeadNotes(
    @Param('id') leadId: string,
    @Req() req: Request,
  ): Promise<CrmNote[]> {
    return this.crmService.findLeadNotes(leadId, this.getOrgId(req));
  }

  @Post('leads/:id/notes')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Add an internal note to lead' })
  async createNote(
    @Param('id') leadId: string,
    @Body() dto: CreateNoteDto,
    @Req() req: Request,
  ): Promise<CrmNote> {
    const actor = this.getActor(req);
    return this.crmService.createNote(leadId, dto, actor, this.getOrgId(req));
  }

  @Delete('notes/:id')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Delete an internal note (Author / Manager / Admin only)' })
  async deleteNote(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ success: boolean }> {
    const actor = this.getActor(req);
    const role = this.getActorRole(req);
    return this.crmService.deleteNote(id, actor, role, this.getOrgId(req));
  }

  // ── Follow-ups ────────────────────────────────────────────────────────

  @Get('followups')
  @RequireRole(ApiKeyRole.VIEWER)
  @ApiOperation({ summary: 'List follow-ups by view (today, upcoming, overdue, completed)' })
  async findFollowups(
    @Query() query: FollowupQueryDto,
    @Req() req: Request,
  ): Promise<{ followups: Array<CrmFollowup & { lead?: CrmLead }>; total: number }> {
    return this.crmService.findFollowups(query, this.getOrgId(req));
  }

  @Post('followups')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Schedule a follow-up' })
  async createFollowup(
    @Body() dto: CreateFollowupDto,
    @Req() req: Request,
  ): Promise<CrmFollowup> {
    const actor = this.getActor(req);
    return this.crmService.createFollowup(dto, actor, this.getOrgId(req));
  }

  @Patch('followups/:id')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Update or complete a follow-up' })
  async updateFollowup(
    @Param('id') id: string,
    @Body() dto: UpdateFollowupDto,
    @Req() req: Request,
  ): Promise<CrmFollowup> {
    const actor = this.getActor(req);
    return this.crmService.updateFollowup(id, dto, actor, this.getOrgId(req));
  }

  @Delete('followups/:id')
  @RequireRole(ApiKeyRole.OPERATOR)
  @ApiOperation({ summary: 'Delete a follow-up (Creator / Assignee / Manager / Admin only)' })
  async deleteFollowup(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ success: boolean }> {
    const actor = this.getActor(req);
    const role = this.getActorRole(req);
    return this.crmService.deleteFollowup(id, actor, role, this.getOrgId(req));
  }

  // ── Activity & Campaign History ───────────────────────────────────────

  @Get('leads/:id/activity')
  @RequireRole(ApiKeyRole.VIEWER)
  @ApiOperation({ summary: 'Get activity timeline for lead' })
  async findLeadActivity(
    @Param('id') leadId: string,
    @Req() req: Request,
  ): Promise<CrmActivity[]> {
    return this.crmService.findLeadActivity(leadId, this.getOrgId(req));
  }

  @Get('leads/:id/campaign-history')
  @RequireRole(ApiKeyRole.VIEWER)
  @ApiOperation({ summary: 'Get campaign dispatch history for lead' })
  async findLeadCampaignHistory(
    @Param('id') leadId: string,
    @Req() req: Request,
  ): Promise<Array<{
    batchId: string;
    campaignName: string;
    sessionId: string;
    status: string;
    sentAt: Date | null;
    messageId?: string;
    error?: string;
  }>> {
    return this.crmService.findLeadCampaignHistory(leadId, this.getOrgId(req));
  }
}
