import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class LoginResponseDto {
  token!: string;
  user!: {
    id: string;
    fullName: string;
    email: string;
    role: string;
    platformRole?: string;
    activeOrganizationId?: string | null;
    status: string;
  };
}
