import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { UserRole } from '../../user/entities/user.entity';

export enum MemberStatus {
  ACTIVE = 'active',
  DISABLED = 'disabled',
}

@Entity('organization_members')
@Index(['organizationId', 'userId'], { unique: true })
export class OrganizationMember {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 100 })
  organizationId!: string;

  @Index()
  @Column({ type: 'varchar', length: 100 })
  userId!: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: UserRole.AGENT,
  })
  role!: UserRole;

  @Column({
    type: 'varchar',
    length: 20,
    default: MemberStatus.ACTIVE,
  })
  status!: MemberStatus;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
