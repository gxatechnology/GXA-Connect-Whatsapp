import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { jsonColumnType } from '../../../common/utils/column-types';

export enum CrmActivityType {
  LEAD_CREATED = 'lead_created',
  STAGE_CHANGED = 'stage_changed',
  TAG_ADDED = 'tag_added',
  TAG_REMOVED = 'tag_removed',
  NOTE_ADDED = 'note_added',
  FOLLOWUP_CREATED = 'followup_created',
  FOLLOWUP_COMPLETED = 'followup_completed',
  ASSIGNED_USER_CHANGED = 'assigned_user_changed',
  CAMPAIGN_REPLY_LINKED = 'campaign_reply_linked',
}

@Entity('crm_activity')
export class CrmActivity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'organization_id', type: 'varchar', length: 100, nullable: true })
  organizationId!: string | null;

  @Index()
  @Column({ name: 'lead_id', type: 'varchar', length: 100 })
  leadId!: string;

  @Column({ name: 'actor_user_id', type: 'varchar', length: 100, nullable: true })
  actorUserId!: string | null;

  @Column({ name: 'actor_name', type: 'varchar', length: 150, nullable: true })
  actorName!: string | null;

  @Column({ type: 'varchar', length: 50 })
  type!: string;

  @Column({ type: jsonColumnType(), nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
