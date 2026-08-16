import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('crm_notes')
export class CrmNote {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'organization_id', type: 'varchar', length: 100, nullable: true })
  organizationId!: string | null;

  @Index()
  @Column({ name: 'lead_id', type: 'varchar', length: 100 })
  leadId!: string;

  @Column({ name: 'author_user_id', type: 'varchar', length: 100, nullable: true })
  authorUserId!: string | null;

  @Column({ name: 'author_name', type: 'varchar', length: 150, nullable: true })
  authorName!: string | null;

  @Column({ type: 'text' })
  content!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
