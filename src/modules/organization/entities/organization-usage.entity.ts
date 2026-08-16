import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('organization_usage')
@Index(['organizationId', 'periodStart'], { unique: true })
export class OrganizationUsage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 100 })
  organizationId!: string;

  @Column({ type: 'datetime' })
  periodStart!: Date;

  @Column({ type: 'datetime' })
  periodEnd!: Date;

  @Column({ type: 'int', default: 0 })
  messagesSent!: number;

  @Column({ type: 'int', default: 0 })
  campaignRecipientsProcessed!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
