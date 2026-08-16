import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateOrganizationAndPlanTables1787200000000 implements MigrationInterface {
  name = 'CreateOrganizationAndPlanTables1787200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isPostgres =
      queryRunner.connection?.options?.type === 'postgres' || queryRunner.dataSource?.options?.type === 'postgres';

    // 1. organizations
    if (isPostgres) {
      await queryRunner.query(
        `CREATE TABLE IF NOT EXISTS "organizations" (` +
          `"id" varchar PRIMARY KEY NOT NULL, ` +
          `"name" varchar(150) NOT NULL, ` +
          `"slug" varchar(100) NOT NULL, ` +
          `"type" varchar(30) NOT NULL DEFAULT 'client', ` +
          `"status" varchar(30) NOT NULL DEFAULT 'active', ` +
          `"parentOrganizationId" varchar(100), ` +
          `"ownerUserId" varchar(100), ` +
          `"planId" varchar(100), ` +
          `"timezone" varchar(50) NOT NULL DEFAULT 'UTC', ` +
          `"createdAt" timestamp NOT NULL DEFAULT NOW(), ` +
          `"updatedAt" timestamp NOT NULL DEFAULT NOW()` +
          `)`,
      );
    } else {
      await queryRunner.query(
        `CREATE TABLE IF NOT EXISTS "organizations" (` +
          `"id" varchar PRIMARY KEY NOT NULL, ` +
          `"name" varchar(150) NOT NULL, ` +
          `"slug" varchar(100) NOT NULL, ` +
          `"type" varchar(30) NOT NULL DEFAULT ('client'), ` +
          `"status" varchar(30) NOT NULL DEFAULT ('active'), ` +
          `"parentOrganizationId" varchar(100), ` +
          `"ownerUserId" varchar(100), ` +
          `"planId" varchar(100), ` +
          `"timezone" varchar(50) NOT NULL DEFAULT ('UTC'), ` +
          `"createdAt" datetime NOT NULL DEFAULT (datetime('now')), ` +
          `"updatedAt" datetime NOT NULL DEFAULT (datetime('now'))` +
          `)`,
      );
    }
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_organizations_slug" ON "organizations" ("slug")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_organizations_parent" ON "organizations" ("parentOrganizationId")`);

    // 2. organization_members
    if (isPostgres) {
      await queryRunner.query(
        `CREATE TABLE IF NOT EXISTS "organization_members" (` +
          `"id" varchar PRIMARY KEY NOT NULL, ` +
          `"organizationId" varchar(100) NOT NULL, ` +
          `"userId" varchar(100) NOT NULL, ` +
          `"role" varchar(20) NOT NULL DEFAULT 'agent', ` +
          `"status" varchar(20) NOT NULL DEFAULT 'active', ` +
          `"createdAt" timestamp NOT NULL DEFAULT NOW(), ` +
          `"updatedAt" timestamp NOT NULL DEFAULT NOW()` +
          `)`,
      );
    } else {
      await queryRunner.query(
        `CREATE TABLE IF NOT EXISTS "organization_members" (` +
          `"id" varchar PRIMARY KEY NOT NULL, ` +
          `"organizationId" varchar(100) NOT NULL, ` +
          `"userId" varchar(100) NOT NULL, ` +
          `"role" varchar(20) NOT NULL DEFAULT ('agent'), ` +
          `"status" varchar(20) NOT NULL DEFAULT ('active'), ` +
          `"createdAt" datetime NOT NULL DEFAULT (datetime('now')), ` +
          `"updatedAt" datetime NOT NULL DEFAULT (datetime('now'))` +
          `)`,
      );
    }
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_org_members_org_user" ON "organization_members" ("organizationId", "userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_org_members_user" ON "organization_members" ("userId")`,
    );

    // 3. plans
    if (isPostgres) {
      await queryRunner.query(
        `CREATE TABLE IF NOT EXISTS "plans" (` +
          `"id" varchar PRIMARY KEY NOT NULL, ` +
          `"name" varchar(150) NOT NULL, ` +
          `"description" text, ` +
          `"status" varchar(20) NOT NULL DEFAULT 'active', ` +
          `"isSystemPlan" boolean NOT NULL DEFAULT false, ` +
          `"maxUsers" integer, ` +
          `"maxWhatsAppAccounts" integer, ` +
          `"maxContacts" integer, ` +
          `"maxMonthlyMessages" integer, ` +
          `"maxCampaignRecipients" integer, ` +
          `"maxClientOrganizations" integer, ` +
          `"apiAccess" boolean NOT NULL DEFAULT true, ` +
          `"crmEnabled" boolean NOT NULL DEFAULT true, ` +
          `"automationEnabled" boolean NOT NULL DEFAULT true, ` +
          `"reportsEnabled" boolean NOT NULL DEFAULT true, ` +
          `"createdAt" timestamp NOT NULL DEFAULT NOW(), ` +
          `"updatedAt" timestamp NOT NULL DEFAULT NOW()` +
          `)`,
      );
    } else {
      await queryRunner.query(
        `CREATE TABLE IF NOT EXISTS "plans" (` +
          `"id" varchar PRIMARY KEY NOT NULL, ` +
          `"name" varchar(150) NOT NULL, ` +
          `"description" text, ` +
          `"status" varchar(20) NOT NULL DEFAULT ('active'), ` +
          `"isSystemPlan" boolean NOT NULL DEFAULT (0), ` +
          `"maxUsers" integer, ` +
          `"maxWhatsAppAccounts" integer, ` +
          `"maxContacts" integer, ` +
          `"maxMonthlyMessages" integer, ` +
          `"maxCampaignRecipients" integer, ` +
          `"maxClientOrganizations" integer, ` +
          `"apiAccess" boolean NOT NULL DEFAULT (1), ` +
          `"crmEnabled" boolean NOT NULL DEFAULT (1), ` +
          `"automationEnabled" boolean NOT NULL DEFAULT (1), ` +
          `"reportsEnabled" boolean NOT NULL DEFAULT (1), ` +
          `"createdAt" datetime NOT NULL DEFAULT (datetime('now')), ` +
          `"updatedAt" datetime NOT NULL DEFAULT (datetime('now'))` +
          `)`,
      );
    }

    // 4. organization_limit_overrides
    if (isPostgres) {
      await queryRunner.query(
        `CREATE TABLE IF NOT EXISTS "organization_limit_overrides" (` +
          `"id" varchar PRIMARY KEY NOT NULL, ` +
          `"organizationId" varchar(100) NOT NULL, ` +
          `"maxUsers" integer, ` +
          `"maxWhatsAppAccounts" integer, ` +
          `"maxContacts" integer, ` +
          `"maxMonthlyMessages" integer, ` +
          `"maxCampaignRecipients" integer, ` +
          `"maxClientOrganizations" integer, ` +
          `"apiAccess" boolean, ` +
          `"crmEnabled" boolean, ` +
          `"automationEnabled" boolean, ` +
          `"reportsEnabled" boolean, ` +
          `"createdAt" timestamp NOT NULL DEFAULT NOW(), ` +
          `"updatedAt" timestamp NOT NULL DEFAULT NOW()` +
          `)`,
      );
    } else {
      await queryRunner.query(
        `CREATE TABLE IF NOT EXISTS "organization_limit_overrides" (` +
          `"id" varchar PRIMARY KEY NOT NULL, ` +
          `"organizationId" varchar(100) NOT NULL, ` +
          `"maxUsers" integer, ` +
          `"maxWhatsAppAccounts" integer, ` +
          `"maxContacts" integer, ` +
          `"maxMonthlyMessages" integer, ` +
          `"maxCampaignRecipients" integer, ` +
          `"maxClientOrganizations" integer, ` +
          `"apiAccess" boolean, ` +
          `"crmEnabled" boolean, ` +
          `"automationEnabled" boolean, ` +
          `"reportsEnabled" boolean, ` +
          `"createdAt" datetime NOT NULL DEFAULT (datetime('now')), ` +
          `"updatedAt" datetime NOT NULL DEFAULT (datetime('now'))` +
          `)`,
      );
    }
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_org_limit_overrides_org" ON "organization_limit_overrides" ("organizationId")`,
    );

    // 5. organization_usage
    if (isPostgres) {
      await queryRunner.query(
        `CREATE TABLE IF NOT EXISTS "organization_usage" (` +
          `"id" varchar PRIMARY KEY NOT NULL, ` +
          `"organizationId" varchar(100) NOT NULL, ` +
          `"periodStart" timestamp NOT NULL, ` +
          `"periodEnd" timestamp NOT NULL, ` +
          `"messagesSent" integer NOT NULL DEFAULT 0, ` +
          `"campaignRecipientsProcessed" integer NOT NULL DEFAULT 0, ` +
          `"createdAt" timestamp NOT NULL DEFAULT NOW(), ` +
          `"updatedAt" timestamp NOT NULL DEFAULT NOW()` +
          `)`,
      );
    } else {
      await queryRunner.query(
        `CREATE TABLE IF NOT EXISTS "organization_usage" (` +
          `"id" varchar PRIMARY KEY NOT NULL, ` +
          `"organizationId" varchar(100) NOT NULL, ` +
          `"periodStart" datetime NOT NULL, ` +
          `"periodEnd" datetime NOT NULL, ` +
          `"messagesSent" integer NOT NULL DEFAULT (0), ` +
          `"campaignRecipientsProcessed" integer NOT NULL DEFAULT (0), ` +
          `"createdAt" datetime NOT NULL DEFAULT (datetime('now')), ` +
          `"updatedAt" datetime NOT NULL DEFAULT (datetime('now'))` +
          `)`,
      );
    }
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_org_usage_org_period" ON "organization_usage" ("organizationId", "periodStart")`,
    );

    // 6. Alter users table for platformRole and activeOrganizationId
    const hasPlatformRole = await queryRunner.hasColumn('users', 'platformRole').catch(() => false);
    if (!hasPlatformRole) {
      const defaultRole = isPostgres ? "'user'" : "('user')";
      await queryRunner.query(
        `ALTER TABLE "users" ADD COLUMN "platformRole" varchar(30) NOT NULL DEFAULT ${defaultRole}`,
      ).catch(() => {});
    }

    const hasActiveOrg = await queryRunner.hasColumn('users', 'activeOrganizationId').catch(() => false);
    if (!hasActiveOrg) {
      await queryRunner.query(
        `ALTER TABLE "users" ADD COLUMN "activeOrganizationId" varchar(100)`,
      ).catch(() => {});
    }

    // 7. Alter api_keys table for organizationId
    const hasApiKeyOrg = await queryRunner.hasColumn('api_keys', 'organizationId').catch(() => false);
    if (!hasApiKeyOrg) {
      await queryRunner.query(
        `ALTER TABLE "api_keys" ADD COLUMN "organizationId" varchar(100)`,
      ).catch(() => {});
      await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_api_keys_org" ON "api_keys" ("organizationId")`).catch(() => {});
    }

    // 8. Safe Data Migration for existing default platform organization
    const orgCount = await queryRunner.query(`SELECT COUNT(*) as count FROM "organizations"`);
    const count = parseInt(orgCount?.[0]?.count || '0', 10);
    if (count === 0) {
      const defaultOrgId = 'org-platform-default';
      await queryRunner.query(
        `INSERT INTO "organizations" ("id", "name", "slug", "type", "status", "timezone") ` +
          `VALUES ('${defaultOrgId}', 'GXA Platform', 'default', 'platform', 'active', 'UTC')`,
      );

      // Backfill existing users:
      // Upgrade only the initial/first admin (or matching ADMIN_EMAIL) to SUPER_ADMIN
      const users = await queryRunner.query(`SELECT "id", "email", "role" FROM "users"`);
      const adminEmail = process.env.ADMIN_EMAIL ? process.env.ADMIN_EMAIL.toLowerCase().trim() : null;
      let superAdminPromoted = false;

      for (let i = 0; i < users.length; i++) {
        const u = users[i];
        let isSuperAdmin = false;
        if (!superAdminPromoted && (adminEmail ? u.email === adminEmail : u.role === 'admin')) {
          isSuperAdmin = true;
          superAdminPromoted = true;
        }

        const platformRole = isSuperAdmin ? 'super_admin' : 'user';
        await queryRunner.query(
          `UPDATE "users" SET "platformRole" = '${platformRole}', "activeOrganizationId" = '${defaultOrgId}' WHERE "id" = '${u.id}'`,
        );

        const memberId = `mem-${u.id.substring(0, 18)}`;
        if (isPostgres) {
          await queryRunner.query(
            `INSERT INTO "organization_members" ("id", "organizationId", "userId", "role", "status") ` +
              `VALUES ('${memberId}', '${defaultOrgId}', '${u.id}', '${u.role || 'agent'}', 'active') ON CONFLICT DO NOTHING`,
          );
        } else {
          await queryRunner.query(
            `INSERT OR IGNORE INTO "organization_members" ("id", "organizationId", "userId", "role", "status") ` +
              `VALUES ('${memberId}', '${defaultOrgId}', '${u.id}', '${u.role || 'agent'}', 'active')`,
          );
        }
      }

      // Backfill existing API keys
      await queryRunner.query(`UPDATE "api_keys" SET "organizationId" = '${defaultOrgId}' WHERE "organizationId" IS NULL`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "organization_usage"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organization_limit_overrides"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "plans"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organization_members"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organizations"`);
  }
}

