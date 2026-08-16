import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('organization_limit_overrides')
export class OrganizationLimitOverride {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100 })
  organizationId!: string;

  @Column({ type: 'int', nullable: true })
  maxUsers!: number | null;

  @Column({ type: 'int', nullable: true })
  maxWhatsAppAccounts!: number | null;

  @Column({ type: 'int', nullable: true })
  maxContacts!: number | null;

  @Column({ type: 'int', nullable: true })
  maxMonthlyMessages!: number | null;

  @Column({ type: 'int', nullable: true })
  maxCampaignRecipients!: number | null;

  @Column({ type: 'int', nullable: true })
  maxClientOrganizations!: number | null;

  @Column({ type: 'boolean', nullable: true })
  apiAccess!: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  crmEnabled!: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  automationEnabled!: boolean | null;

  @Column({ type: 'boolean', nullable: true })
  reportsEnabled!: boolean | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
