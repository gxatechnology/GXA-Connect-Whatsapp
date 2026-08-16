import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum PlanStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

@Entity('plans')
export class Plan {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: PlanStatus.ACTIVE,
  })
  status!: PlanStatus;

  @Column({ type: 'boolean', default: false })
  isSystemPlan!: boolean;

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

  @Column({ type: 'boolean', default: true })
  apiAccess!: boolean;

  @Column({ type: 'boolean', default: true })
  crmEnabled!: boolean;

  @Column({ type: 'boolean', default: true })
  automationEnabled!: boolean;

  @Column({ type: 'boolean', default: true })
  reportsEnabled!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
