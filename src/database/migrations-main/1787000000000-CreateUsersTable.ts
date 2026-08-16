import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersTable1787000000000 implements MigrationInterface {
  name = 'CreateUsersTable1787000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const isPostgres =
      queryRunner.connection?.options?.type === 'postgres' || queryRunner.dataSource?.options?.type === 'postgres';

    if (isPostgres) {
      await queryRunner.query(
        `CREATE TABLE IF NOT EXISTS "users" (` +
          `"id" varchar PRIMARY KEY NOT NULL, ` +
          `"fullName" varchar(150) NOT NULL, ` +
          `"email" varchar(150) NOT NULL, ` +
          `"passwordHash" varchar(255) NOT NULL, ` +
          `"role" varchar(20) NOT NULL DEFAULT 'agent', ` +
          `"status" varchar(20) NOT NULL DEFAULT 'active', ` +
          `"tokenVersion" integer NOT NULL DEFAULT 1, ` +
          `"lastLoginAt" timestamp, ` +
          `"createdAt" timestamp NOT NULL DEFAULT NOW(), ` +
          `"updatedAt" timestamp NOT NULL DEFAULT NOW()` +
          `)`,
      );
    } else {
      await queryRunner.query(
        `CREATE TABLE IF NOT EXISTS "users" (` +
          `"id" varchar PRIMARY KEY NOT NULL, ` +
          `"fullName" varchar(150) NOT NULL, ` +
          `"email" varchar(150) NOT NULL, ` +
          `"passwordHash" varchar(255) NOT NULL, ` +
          `"role" varchar(20) NOT NULL DEFAULT ('agent'), ` +
          `"status" varchar(20) NOT NULL DEFAULT ('active'), ` +
          `"tokenVersion" integer NOT NULL DEFAULT (1), ` +
          `"lastLoginAt" datetime, ` +
          `"createdAt" datetime NOT NULL DEFAULT (datetime('now')), ` +
          `"updatedAt" datetime NOT NULL DEFAULT (datetime('now'))` +
          `)`,
      );
    }
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_email" ON "users" ("email")`);

    // In case the users table already existed from a previous run without tokenVersion
    const hasTokenVersion = await queryRunner.hasColumn('users', 'tokenVersion').catch(() => false);
    if (!hasTokenVersion) {
      const defaultVal = isPostgres ? '1' : '(1)';
      await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "tokenVersion" integer NOT NULL DEFAULT ${defaultVal}`).catch(() => {
        // Ignored if column already exists
      });
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_email"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}
