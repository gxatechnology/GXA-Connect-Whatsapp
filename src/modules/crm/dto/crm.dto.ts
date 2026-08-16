import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsArray,
  IsDateString,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LeadStage, LeadSource, LeadStatus } from '../entities/crm-lead.entity';
import { FollowupStatus, FollowupType } from '../entities/crm-followup.entity';
import { ToStrictNumber } from '../../../common/utils/strict-boolean';

export class CreateLeadDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @IsOptional()
  contactId?: string;

  @IsString()
  @IsOptional()
  sessionId?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  company?: string;

  @IsString()
  @IsOptional()
  source?: string = LeadSource.MANUAL;

  @IsEnum(LeadStage)
  @IsOptional()
  stage?: LeadStage = LeadStage.NEW;

  @IsString()
  @IsOptional()
  assignedUserId?: string;

  @IsArray()
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateLeadDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  company?: string;

  @IsString()
  @IsOptional()
  source?: string;

  @IsEnum(LeadStage)
  @IsOptional()
  stage?: LeadStage;

  @IsString()
  @IsOptional()
  assignedUserId?: string | null;

  @IsEnum(LeadStatus)
  @IsOptional()
  status?: LeadStatus;
}

export class CreateNoteDto {
  @IsString()
  @IsNotEmpty()
  content!: string;
}

export class CreateTagDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  color?: string = '#0B4DBB';
}

export class CreateFollowupDto {
  @IsString()
  @IsNotEmpty()
  leadId!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  type?: string = FollowupType.GENERAL;

  @IsDateString()
  @IsNotEmpty()
  dueAt!: string;

  @IsString()
  @IsOptional()
  assignedUserId?: string;
}

export class UpdateFollowupDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsDateString()
  @IsOptional()
  dueAt?: string;

  @IsEnum(FollowupStatus)
  @IsOptional()
  status?: FollowupStatus;

  @IsString()
  @IsOptional()
  assignedUserId?: string | null;
}

export class LeadQueryDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  stage?: string;

  @IsString()
  @IsOptional()
  source?: string;

  @IsString()
  @IsOptional()
  assignedUserId?: string;

  @IsString()
  @IsOptional()
  tagId?: string;

  @IsString()
  @IsOptional()
  status?: string = 'active';

  @ToStrictNumber()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  limit?: number = 50;

  @ToStrictNumber()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  offset?: number = 0;
}

export class FollowupQueryDto {
  @IsString()
  @IsOptional()
  view?: 'today' | 'upcoming' | 'overdue' | 'completed' | 'all' = 'today';

  @IsString()
  @IsOptional()
  assignedUserId?: string;

  @IsString()
  @IsOptional()
  leadId?: string;

  @ToStrictNumber()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  limit?: number = 50;

  @ToStrictNumber()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  offset?: number = 0;
}
