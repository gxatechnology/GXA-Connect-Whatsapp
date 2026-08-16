import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum PlatformRole {
  SUPER_ADMIN = 'super_admin',
  RESELLER_ADMIN = 'reseller_admin',
  USER = 'user',
}

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  AGENT = 'agent',
  VIEWER = 'viewer',
}

export enum UserStatus {
  ACTIVE = 'active',
  DISABLED = 'disabled',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 150 })
  fullName!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 150 })
  email!: string;

  @Column({ type: 'varchar', length: 255, select: false })
  passwordHash!: string;

  @Column({
    type: 'varchar',
    length: 30,
    default: PlatformRole.USER,
  })
  platformRole?: PlatformRole;

  @Column({
    type: 'varchar',
    length: 20,
    default: UserRole.AGENT,
  })
  role!: UserRole;

  @Column({
    type: 'varchar',
    length: 20,
    default: UserStatus.ACTIVE,
  })
  status!: UserStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  activeOrganizationId?: string | null;

  @Column({ type: 'int', default: 1 })
  tokenVersion!: number;

  @Column({ type: 'datetime', nullable: true })
  lastLoginAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
