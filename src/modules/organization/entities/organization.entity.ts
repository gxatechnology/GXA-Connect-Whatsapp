import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum OrganizationType {
  PLATFORM = 'platform',
  RESELLER = 'reseller',
  CLIENT = 'client',
}

export enum OrganizationStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  ARCHIVED = 'archived',
}

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100 })
  slug!: string;

  @Column({
    type: 'varchar',
    length: 30,
    default: OrganizationType.CLIENT,
  })
  type!: OrganizationType;

  @Column({
    type: 'varchar',
    length: 30,
    default: OrganizationStatus.ACTIVE,
  })
  status!: OrganizationStatus;

  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true })
  parentOrganizationId!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  ownerUserId!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  planId!: string | null;

  @Column({ type: 'varchar', length: 50, default: 'UTC' })
  timezone!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
