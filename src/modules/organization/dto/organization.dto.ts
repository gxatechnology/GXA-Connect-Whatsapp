import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsEmail,
  MinLength,
} from 'class-validator';
import { OrganizationType, OrganizationStatus } from '../entities/organization.entity';
import { UserRole } from '../../user/entities/user.entity';

export class CreateOrganizationDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  slug!: string;

  @IsEnum(OrganizationType)
  @IsOptional()
  type?: OrganizationType = OrganizationType.CLIENT;

  @IsString()
  @IsOptional()
  parentOrganizationId?: string;

  @IsString()
  @IsOptional()
  planId?: string;

  @IsString()
  @IsOptional()
  timezone?: string = 'UTC';

  // Optional initial admin creation
  @IsString()
  @IsOptional()
  adminFullName?: string;

  @IsEmail()
  @IsOptional()
  adminEmail?: string;

  @IsString()
  @MinLength(6)
  @IsOptional()
  adminPassword?: string;
}

export class UpdateOrganizationDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  slug?: string;

  @IsEnum(OrganizationStatus)
  @IsOptional()
  status?: OrganizationStatus;

  @IsString()
  @IsOptional()
  planId?: string;

  @IsString()
  @IsOptional()
  timezone?: string;
}

export class AddMemberDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsString()
  @MinLength(6)
  @IsOptional()
  password?: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole = UserRole.AGENT;
}

export class UpdateMemberRoleDto {
  @IsEnum(UserRole)
  @IsNotEmpty()
  role!: UserRole;
}

export class SwitchOrganizationDto {
  @IsString()
  @IsNotEmpty()
  organizationId!: string;
}
