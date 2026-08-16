import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCrmTables1787100000000 implements MigrationInterface {
  name = 'CreateCrmTables1787100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isPostgres = queryRunner.dataSource.options.type === 'postgres';

    // crm_leads
    const leadsExist = await queryRunner.hasTable('crm_leads');
    if (!leadsExist) {
      if (isPostgres) {
        await queryRunner.query(
          `CREATE TABLE "crm_leads" (` +
            `"id" varchar PRIMARY KEY NOT NULL DEFAULT gen_random_uuid()::varchar, ` +
            `"contact_id" varchar(150), ` +
            `"session_id" varchar(100), ` +
            `"name" varchar(200) NOT NULL, ` +
            `"phone" varchar(50) NOT NULL, ` +
            `"email" varchar(150), ` +
            `"company" varchar(150), ` +
            `"source" varchar(50) NOT NULL DEFAULT 'Manual', ` +
            `"stage" varchar(50) NOT NULL DEFAULT 'New', ` +
            `"assigned_user_id" varchar(100), ` +
            `"status" varchar(20) NOT NULL DEFAULT 'active', ` +
            `"next_follow_up_at" timestamp, ` +
            `"last_activity_at" timestamp, ` +
            `"created_at" timestamp NOT NULL DEFAULT NOW(), ` +
            `"updated_at" timestamp NOT NULL DEFAULT NOW()` +
            `)`,
        );
      } else {
        await queryRunner.query(
          `CREATE TABLE "crm_leads" (` +
            `"id" varchar PRIMARY KEY NOT NULL, ` +
            `"contact_id" varchar(150), ` +
            `"session_id" varchar(100), ` +
            `"name" varchar(200) NOT NULL, ` +
            `"phone" varchar(50) NOT NULL, ` +
            `"email" varchar(150), ` +
            `"company" varchar(150), ` +
            `"source" varchar(50) NOT NULL DEFAULT 'Manual', ` +
            `"stage" varchar(50) NOT NULL DEFAULT 'New', ` +
            `"assigned_user_id" varchar(100), ` +
            `"status" varchar(20) NOT NULL DEFAULT 'active', ` +
            `"next_follow_up_at" datetime, ` +
            `"last_activity_at" datetime, ` +
            `"created_at" datetime NOT NULL DEFAULT (datetime('now')), ` +
            `"updated_at" datetime NOT NULL DEFAULT (datetime('now'))` +
            `)`,
        );
      }
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_crm_leads_phone" ON "crm_leads" ("phone")`);
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_crm_leads_stage" ON "crm_leads" ("stage")`);
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_crm_leads_assigned_user_id" ON "crm_leads" ("assigned_user_id")`);
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_crm_leads_status" ON "crm_leads" ("status")`);
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_crm_leads_next_follow_up_at" ON "crm_leads" ("next_follow_up_at")`);
    }

    // crm_notes
    const notesExist = await queryRunner.hasTable('crm_notes');
    if (!notesExist) {
      if (isPostgres) {
        await queryRunner.query(
          `CREATE TABLE "crm_notes" (` +
            `"id" varchar PRIMARY KEY NOT NULL DEFAULT gen_random_uuid()::varchar, ` +
            `"lead_id" varchar(100) NOT NULL, ` +
            `"author_user_id" varchar(100), ` +
            `"author_name" varchar(150), ` +
            `"content" text NOT NULL, ` +
            `"created_at" timestamp NOT NULL DEFAULT NOW(), ` +
            `"updated_at" timestamp NOT NULL DEFAULT NOW()` +
            `)`,
        );
      } else {
        await queryRunner.query(
          `CREATE TABLE "crm_notes" (` +
            `"id" varchar PRIMARY KEY NOT NULL, ` +
            `"lead_id" varchar(100) NOT NULL, ` +
            `"author_user_id" varchar(100), ` +
            `"author_name" varchar(150), ` +
            `"content" text NOT NULL, ` +
            `"created_at" datetime NOT NULL DEFAULT (datetime('now')), ` +
            `"updated_at" datetime NOT NULL DEFAULT (datetime('now'))` +
            `)`,
        );
      }
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_crm_notes_lead_id" ON "crm_notes" ("lead_id")`);
    }

    // crm_tags
    const tagsExist = await queryRunner.hasTable('crm_tags');
    if (!tagsExist) {
      if (isPostgres) {
        await queryRunner.query(
          `CREATE TABLE "crm_tags" (` +
            `"id" varchar PRIMARY KEY NOT NULL DEFAULT gen_random_uuid()::varchar, ` +
            `"name" varchar(100) NOT NULL, ` +
            `"color" varchar(30) NOT NULL DEFAULT '#0B4DBB', ` +
            `"created_by" varchar(100), ` +
            `"created_at" timestamp NOT NULL DEFAULT NOW()` +
            `)`,
        );
      } else {
        await queryRunner.query(
          `CREATE TABLE "crm_tags" (` +
            `"id" varchar PRIMARY KEY NOT NULL, ` +
            `"name" varchar(100) NOT NULL, ` +
            `"color" varchar(30) NOT NULL DEFAULT '#0B4DBB', ` +
            `"created_by" varchar(100), ` +
            `"created_at" datetime NOT NULL DEFAULT (datetime('now'))` +
            `)`,
        );
      }
      await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_crm_tags_name" ON "crm_tags" ("name")`);
    }

    // crm_lead_tags
    const leadTagsExist = await queryRunner.hasTable('crm_lead_tags');
    if (!leadTagsExist) {
      if (isPostgres) {
        await queryRunner.query(
          `CREATE TABLE "crm_lead_tags" (` +
            `"id" varchar PRIMARY KEY NOT NULL DEFAULT gen_random_uuid()::varchar, ` +
            `"lead_id" varchar(100) NOT NULL, ` +
            `"tag_id" varchar(100) NOT NULL, ` +
            `"created_at" timestamp NOT NULL DEFAULT NOW()` +
            `)`,
        );
      } else {
        await queryRunner.query(
          `CREATE TABLE "crm_lead_tags" (` +
            `"id" varchar PRIMARY KEY NOT NULL, ` +
            `"lead_id" varchar(100) NOT NULL, ` +
            `"tag_id" varchar(100) NOT NULL, ` +
            `"created_at" datetime NOT NULL DEFAULT (datetime('now'))` +
            `)`,
        );
      }
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_crm_lead_tags_lead_id" ON "crm_lead_tags" ("lead_id")`);
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_crm_lead_tags_tag_id" ON "crm_lead_tags" ("tag_id")`);
    }

    // crm_followups
    const followupsExist = await queryRunner.hasTable('crm_followups');
    if (!followupsExist) {
      if (isPostgres) {
        await queryRunner.query(
          `CREATE TABLE "crm_followups" (` +
            `"id" varchar PRIMARY KEY NOT NULL DEFAULT gen_random_uuid()::varchar, ` +
            `"lead_id" varchar(100) NOT NULL, ` +
            `"assigned_user_id" varchar(100), ` +
            `"title" varchar(250) NOT NULL, ` +
            `"notes" text, ` +
            `"type" varchar(50) NOT NULL DEFAULT 'General', ` +
            `"due_at" timestamp NOT NULL, ` +
            `"status" varchar(30) NOT NULL DEFAULT 'Pending', ` +
            `"completed_at" timestamp, ` +
            `"created_by" varchar(100), ` +
            `"created_at" timestamp NOT NULL DEFAULT NOW(), ` +
            `"updated_at" timestamp NOT NULL DEFAULT NOW()` +
            `)`,
        );
      } else {
        await queryRunner.query(
          `CREATE TABLE "crm_followups" (` +
            `"id" varchar PRIMARY KEY NOT NULL, ` +
            `"lead_id" varchar(100) NOT NULL, ` +
            `"assigned_user_id" varchar(100), ` +
            `"title" varchar(250) NOT NULL, ` +
            `"notes" text, ` +
            `"type" varchar(50) NOT NULL DEFAULT 'General', ` +
            `"due_at" datetime NOT NULL, ` +
            `"status" varchar(30) NOT NULL DEFAULT 'Pending', ` +
            `"completed_at" datetime, ` +
            `"created_by" varchar(100), ` +
            `"created_at" datetime NOT NULL DEFAULT (datetime('now')), ` +
            `"updated_at" datetime NOT NULL DEFAULT (datetime('now'))` +
            `)`,
        );
      }
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_crm_followups_lead_id" ON "crm_followups" ("lead_id")`);
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_crm_followups_assigned_user_id" ON "crm_followups" ("assigned_user_id")`);
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_crm_followups_due_at" ON "crm_followups" ("due_at")`);
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_crm_followups_status" ON "crm_followups" ("status")`);
    }

    // crm_activity
    const activityExist = await queryRunner.hasTable('crm_activity');
    if (!activityExist) {
      if (isPostgres) {
        await queryRunner.query(
          `CREATE TABLE "crm_activity" (` +
            `"id" varchar PRIMARY KEY NOT NULL DEFAULT gen_random_uuid()::varchar, ` +
            `"lead_id" varchar(100) NOT NULL, ` +
            `"actor_user_id" varchar(100), ` +
            `"actor_name" varchar(150), ` +
            `"type" varchar(50) NOT NULL, ` +
            `"metadata" text, ` +
            `"created_at" timestamp NOT NULL DEFAULT NOW()` +
            `)`,
        );
      } else {
        await queryRunner.query(
          `CREATE TABLE "crm_activity" (` +
            `"id" varchar PRIMARY KEY NOT NULL, ` +
            `"lead_id" varchar(100) NOT NULL, ` +
            `"actor_user_id" varchar(100), ` +
            `"actor_name" varchar(150), ` +
            `"type" varchar(50) NOT NULL, ` +
            `"metadata" text, ` +
            `"created_at" datetime NOT NULL DEFAULT (datetime('now'))` +
            `)`,
        );
      }
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_crm_activity_lead_id" ON "crm_activity" ("lead_id")`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "crm_activity"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "crm_followups"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "crm_lead_tags"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "crm_tags"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "crm_notes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "crm_leads"`);
  }
}
