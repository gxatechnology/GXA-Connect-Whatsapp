import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('crm_lead_tags')
@Unique('UQ_crm_lead_tags_lead_tag', ['leadId', 'tagId'])
export class CrmLeadTag {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'lead_id', type: 'varchar', length: 100 })
  leadId!: string;

  @Index()
  @Column({ name: 'tag_id', type: 'varchar', length: 100 })
  tagId!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
