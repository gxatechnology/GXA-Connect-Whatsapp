import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum FollowupStatus {
  PENDING = 'Pending',
  COMPLETED = 'Completed',
  CANCELLED = 'Cancelled',
}

export enum FollowupType {
  CALL = 'Call',
  WHATSAPP = 'WhatsApp',
  MEETING = 'Meeting',
  PAYMENT = 'Payment',
  PROPOSAL = 'Proposal',
  GENERAL = 'General',
}

@Entity('crm_followups')
export class CrmFollowup {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'organization_id', type: 'varchar', length: 100, nullable: true })
  organizationId!: string | null;

  @Index()
  @Column({ name: 'lead_id', type: 'varchar', length: 100 })
  leadId!: string;

  @Index()
  @Column({ name: 'assigned_user_id', type: 'varchar', length: 100, nullable: true })
  assignedUserId!: string | null;

  @Column({ type: 'varchar', length: 250 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  notes!: string | null;

  @Column({
    type: 'varchar',
    length: 50,
    default: FollowupType.GENERAL,
  })
  type!: string;

  @Index()
  @Column({ name: 'due_at', type: 'datetime' })
  dueAt!: Date;

  @Index()
  @Column({
    type: 'varchar',
    length: 30,
    default: FollowupStatus.PENDING,
  })
  status!: FollowupStatus;

  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt!: Date | null;

  @Column({ name: 'created_by', type: 'varchar', length: 100, nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
