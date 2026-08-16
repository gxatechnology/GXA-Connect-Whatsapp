import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum LeadStage {
  NEW = 'New',
  CONTACTED = 'Contacted',
  QUALIFIED = 'Qualified',
  PROPOSAL = 'Proposal',
  WON = 'Won',
  LOST = 'Lost',
}

export enum LeadSource {
  WHATSAPP = 'WhatsApp',
  CAMPAIGN = 'Campaign',
  MANUAL = 'Manual',
  IMPORTED = 'Imported',
  WEBSITE = 'Website',
  REFERRAL = 'Referral',
  OTHER = 'Other',
}

export enum LeadStatus {
  ACTIVE = 'active',
  ARCHIVED = 'archived',
}

@Entity('crm_leads')
export class CrmLead {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'contact_id', type: 'varchar', length: 150, nullable: true })
  contactId!: string | null;

  @Column({ name: 'session_id', type: 'varchar', length: 100, nullable: true })
  sessionId!: string | null;

  @Index()
  @Column({ name: 'organization_id', type: 'varchar', length: 100, nullable: true })
  organizationId!: string | null;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Index()
  @Column({ type: 'varchar', length: 50 })
  phone!: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  email!: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  company!: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    default: LeadSource.MANUAL,
  })
  source!: string;

  @Index()
  @Column({
    type: 'varchar',
    length: 50,
    default: LeadStage.NEW,
  })
  stage!: LeadStage;

  @Index()
  @Column({ name: 'assigned_user_id', type: 'varchar', length: 100, nullable: true })
  assignedUserId!: string | null;

  @Index()
  @Column({
    type: 'varchar',
    length: 20,
    default: LeadStatus.ACTIVE,
  })
  status!: LeadStatus;

  @Index()
  @Column({ name: 'next_follow_up_at', type: 'datetime', nullable: true })
  nextFollowUpAt!: Date | null;

  @Column({ name: 'last_activity_at', type: 'datetime', nullable: true })
  lastActivityAt!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
