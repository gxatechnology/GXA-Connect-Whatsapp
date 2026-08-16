import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsEnum,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PlanStatus } from '../entities/plan.entity';
import { ToStrictNumber, ToStrictBoolean } from '../../../common/utils/strict-boolean';

export class CreatePlanDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @ToStrictNumber()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  maxUsers?: number | null;

  @ToStrictNumber()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  maxWhatsAppAccounts?: number | null;

  @ToStrictNumber()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  maxContacts?: number | null;

  @ToStrictNumber()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  maxMonthlyMessages?: number | null;

  @ToStrictNumber()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  maxCampaignRecipients?: number | null;

  @ToStrictNumber()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  maxClientOrganizations?: number | null;

  @ToStrictBoolean()
  @IsBoolean()
  @IsOptional()
  apiAccess?: boolean = true;

  @ToStrictBoolean()
  @IsBoolean()
  @IsOptional()
  crmEnabled?: boolean = true;

  @ToStrictBoolean()
  @IsBoolean()
  @IsOptional()
  automationEnabled?: boolean = true;

  @ToStrictBoolean()
  @IsBoolean()
  @IsOptional()
  reportsEnabled?: boolean = true;
}

export class UpdatePlanDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(PlanStatus)
  @IsOptional()
  status?: PlanStatus;

  @ToStrictNumber()
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  maxUsers?: number | null;

  @ToStrictNumber()
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  maxWhatsAppAccounts?: number | null;

  @ToStrictNumber()
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  maxContacts?: number | null;

  @ToStrictNumber()
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  maxMonthlyMessages?: number | null;

  @ToStrictNumber()
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  maxCampaignRecipients?: number | null;

  @ToStrictNumber()
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  maxClientOrganizations?: number | null;

  @ToStrictBoolean()
  @IsBoolean()
  @IsOptional()
  apiAccess?: boolean;

  @ToStrictBoolean()
  @IsBoolean()
  @IsOptional()
  crmEnabled?: boolean;

  @ToStrictBoolean()
  @IsBoolean()
  @IsOptional()
  automationEnabled?: boolean;

  @ToStrictBoolean()
  @IsBoolean()
  @IsOptional()
  reportsEnabled?: boolean;
}

export class SetLimitOverrideDto {
  @ToStrictNumber()
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  maxUsers?: number | null;

  @ToStrictNumber()
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  maxWhatsAppAccounts?: number | null;

  @ToStrictNumber()
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  maxContacts?: number | null;

  @ToStrictNumber()
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  maxMonthlyMessages?: number | null;

  @ToStrictNumber()
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  maxCampaignRecipients?: number | null;

  @ToStrictNumber()
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  maxClientOrganizations?: number | null;

  @ToStrictBoolean()
  @IsBoolean()
  @IsOptional()
  apiAccess?: boolean | null;

  @ToStrictBoolean()
  @IsBoolean()
  @IsOptional()
  crmEnabled?: boolean | null;

  @ToStrictBoolean()
  @IsBoolean()
  @IsOptional()
  automationEnabled?: boolean | null;

  @ToStrictBoolean()
  @IsBoolean()
  @IsOptional()
  reportsEnabled?: boolean | null;
}
