#!/usr/bin/env node
/**
 * GXA Connect — Non-Destructive SQLite to PostgreSQL Data Migration Tool
 *
 * Reads real production data from local SQLite databases (main.sqlite and openwa.sqlite)
 * in read-only mode and writes to a target PostgreSQL database.
 *
 * Requirements:
 * - Target PostgreSQL migrations must already be executed (schema exists).
 * - Flags:
 *     --dry-run      Simulates the migration and prints row counts without writing.
 *     --verify-only  Compares row counts between source SQLite and target PostgreSQL.
 *
 * Usage:
 *   npx ts-node scripts/migrate-sqlite-to-postgres.ts --dry-run
 *   npx ts-node scripts/migrate-sqlite-to-postgres.ts
 *   npx ts-node scripts/migrate-sqlite-to-postgres.ts --verify-only
 */

import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';
import { Client } from 'pg';
import { parsePostgresUrl } from '../src/database/database-url.util';

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerifyOnly = args.includes('--verify-only');

// Paths to local SQLite files
const mainSqlitePath = process.env.MAIN_DATABASE_NAME || path.resolve(process.cwd(), 'data', 'main.sqlite');
const dataSqlitePath = process.env.DATABASE_NAME || path.resolve(process.cwd(), 'data', 'openwa.sqlite');

// Target PostgreSQL connection string
const targetUrl =
  process.env.TARGET_DATABASE_URL ||
  process.env.DATABASE_URL ||
  process.env.DATA_DATABASE_URL ||
  process.env.MAIN_DATABASE_URL;

if (!targetUrl) {
  console.error('❌ Error: Target PostgreSQL URL is not configured. Set DATABASE_URL or TARGET_DATABASE_URL.');
  process.exit(1);
}

const parsedPg = parsePostgresUrl(targetUrl);
if (!parsedPg) {
  console.error('❌ Error: Invalid PostgreSQL connection URL provided.');
  process.exit(1);
}

// Table migration ordering (topologically sorted to satisfy FK constraints)
interface TableConfig {
  name: string;
  sourceDb: 'main' | 'data';
  booleanColumns?: string[];
  jsonColumns?: string[];
  timestampColumns?: string[];
}

const TABLES: TableConfig[] = [
  // 1. Organizations & Members (Main)
  {
    name: 'organizations',
    sourceDb: 'main',
    timestampColumns: ['createdAt', 'updatedAt'],
  },
  {
    name: 'plans',
    sourceDb: 'main',
    booleanColumns: ['isSystemPlan', 'apiAccess', 'crmEnabled', 'automationEnabled', 'reportsEnabled'],
    timestampColumns: ['createdAt', 'updatedAt'],
  },
  {
    name: 'users',
    sourceDb: 'main',
    timestampColumns: ['lastLoginAt', 'createdAt', 'updatedAt'],
  },
  {
    name: 'organization_members',
    sourceDb: 'main',
    timestampColumns: ['createdAt', 'updatedAt'],
  },
  {
    name: 'organization_limit_overrides',
    sourceDb: 'main',
    booleanColumns: ['apiAccess', 'crmEnabled', 'automationEnabled', 'reportsEnabled'],
    timestampColumns: ['createdAt', 'updatedAt'],
  },
  {
    name: 'organization_usage',
    sourceDb: 'main',
    timestampColumns: ['periodStart', 'periodEnd', 'createdAt', 'updatedAt'],
  },
  {
    name: 'api_keys',
    sourceDb: 'main',
    booleanColumns: ['isActive'],
    timestampColumns: ['expiresAt', 'lastUsedAt', 'createdAt', 'updatedAt'],
  },
  {
    name: 'audit_logs',
    sourceDb: 'main',
    timestampColumns: ['createdAt'],
  },

  // 2. Data Tables (Data)
  {
    name: 'sessions',
    sourceDb: 'data',
    booleanColumns: ['meHostBlocked'],
    jsonColumns: ['config'],
    timestampColumns: ['lastSeen', 'connectedAt', 'disconnectedAt', 'createdAt', 'updatedAt'],
  },
  {
    name: 'templates',
    sourceDb: 'data',
    jsonColumns: ['variables'],
    timestampColumns: ['createdAt', 'updatedAt'],
  },
  {
    name: 'webhooks',
    sourceDb: 'data',
    booleanColumns: ['active'],
    jsonColumns: ['events', 'customHeaders', 'filters'],
    timestampColumns: ['createdAt', 'updatedAt'],
  },
  {
    name: 'webhook_delivery_failures',
    sourceDb: 'data',
    jsonColumns: ['payload', 'requestHeaders'],
    timestampColumns: ['failedAt'],
  },
  {
    name: 'crm_tags',
    sourceDb: 'data',
    timestampColumns: ['created_at', 'updated_at'],
  },
  {
    name: 'crm_leads',
    sourceDb: 'data',
    timestampColumns: ['next_follow_up_at', 'last_activity_at', 'created_at', 'updated_at'],
  },
  {
    name: 'crm_notes',
    sourceDb: 'data',
    timestampColumns: ['created_at', 'updated_at'],
  },
  {
    name: 'crm_lead_tags',
    sourceDb: 'data',
    timestampColumns: ['created_at'],
  },
  {
    name: 'crm_followups',
    sourceDb: 'data',
    timestampColumns: ['scheduled_at', 'completed_at', 'created_at', 'updated_at'],
  },
  {
    name: 'crm_activity',
    sourceDb: 'data',
    jsonColumns: ['metadata'],
    timestampColumns: ['created_at'],
  },
  {
    name: 'message_batches',
    sourceDb: 'data',
    booleanColumns: ['stopOnError'],
    jsonColumns: ['messages', 'results', 'progress', 'error'],
    timestampColumns: ['scheduledAt', 'startedAt', 'completedAt', 'createdAt', 'updatedAt'],
  },
  {
    name: 'messages',
    sourceDb: 'data',
    booleanColumns: ['fromMe', 'isForwarded', 'isStarred', 'mediaOmitted'],
    jsonColumns: ['media', 'quotedMessage', 'mentionedIds', 'metadata'],
    timestampColumns: ['timestamp', 'createdAt', 'updatedAt'],
  },
  {
    name: 'baileys_stored_messages',
    sourceDb: 'data',
    jsonColumns: ['message'],
    timestampColumns: ['createdAt'],
  },
  {
    name: 'lid_mappings',
    sourceDb: 'data',
    timestampColumns: ['createdAt', 'updatedAt'],
  },
  {
    name: 'automation_rules',
    sourceDb: 'data',
    booleanColumns: ['active', 'stopProcessing'],
    jsonColumns: ['keywords', 'replyMedia'],
    timestampColumns: ['createdAt', 'updatedAt'],
  },
  {
    name: 'status_updates',
    sourceDb: 'data',
    booleanColumns: ['fromMe', 'mediaOmitted'],
    timestampColumns: ['timestamp', 'expiresAt', 'createdAt'],
  },
  {
    name: 'conversation_mappings',
    sourceDb: 'data',
    jsonColumns: ['metadata'],
    timestampColumns: ['createdAt', 'updatedAt'],
  },
  {
    name: 'ingress_events',
    sourceDb: 'data',
    jsonColumns: ['payload', 'headers'],
    timestampColumns: ['receivedAt'],
  },
  {
    name: 'integration_delivery_failures',
    sourceDb: 'data',
    jsonColumns: ['payload', 'requestHeaders'],
    timestampColumns: ['failedAt'],
  },
  {
    name: 'plugin_instances',
    sourceDb: 'data',
    booleanColumns: ['enabled'],
    jsonColumns: ['config', 'secrets'],
    timestampColumns: ['createdAt', 'updatedAt'],
  },
];

async function run() {
  console.log('====================================================');
  console.log('  GXA CONNECT: SQLite → PostgreSQL Migration Tool   ');
  console.log('====================================================\n');

  if (isVerifyOnly) {
    console.log('🔍 MODE: VERIFY ONLY (comparing source and target record counts)\n');
  } else if (isDryRun) {
    console.log('🔍 MODE: DRY RUN (simulating migration, zero database writes)\n');
  } else {
    console.log('🚀 MODE: LIVE MIGRATION (inserting records into PostgreSQL in transaction)\n');
  }

  // Open SQLite databases in READ-ONLY mode
  let mainSqlite: Database.Database | null = null;
  let dataSqlite: Database.Database | null = null;

  if (fs.existsSync(mainSqlitePath)) {
    mainSqlite = new Database(mainSqlitePath, { readonly: true, fileMustExist: true });
    console.log(`✅ Main SQLite opened (read-only): ${mainSqlitePath}`);
  } else {
    console.warn(`⚠️ Main SQLite file not found at: ${mainSqlitePath}`);
  }

  if (fs.existsSync(dataSqlitePath)) {
    dataSqlite = new Database(dataSqlitePath, { readonly: true, fileMustExist: true });
    console.log(`✅ Data SQLite opened (read-only): ${dataSqlitePath}`);
  } else {
    console.warn(`⚠️ Data SQLite file not found at: ${dataSqlitePath}`);
  }

  // Connect to target PostgreSQL
  const pgClient = new Client({
    host: parsedPg.host,
    port: parsedPg.port,
    user: parsedPg.username,
    password: parsedPg.password,
    database: parsedPg.database,
    ssl: parsedPg.ssl ? { rejectUnauthorized: false } : false,
  });

  try {
    await pgClient.connect();
    console.log(`✅ Connected to target PostgreSQL: ${parsedPg.host}:${parsedPg.port}/${parsedPg.database}\n`);
  } catch (err) {
    console.error(`❌ Failed to connect to PostgreSQL: ${String(err)}`);
    process.exit(1);
  }

  console.log('----------------------------------------------------');
  console.log(
    `${'Table Name'.padEnd(30)} | ${'Source (SQLite)'.padStart(15)} | ${'Target (Postgres)'.padStart(17)} | Status`,
  );
  console.log('----------------------------------------------------');

  let totalSourceRows = 0;
  let totalTargetRows = 0;
  let hasErrors = false;

  if (!isDryRun && !isVerifyOnly) {
    await pgClient.query('BEGIN');
  }

  try {
    for (const table of TABLES) {
      const sqlite = table.sourceDb === 'main' ? mainSqlite : dataSqlite;
      let sourceCount = 0;
      let targetCountBefore = 0;

      // 1. Check if table exists in SQLite
      if (sqlite) {
        try {
          const sqliteTableExists = sqlite
            .prepare(`SELECT count(*) as c FROM sqlite_master WHERE type='table' AND name=?`)
            .get(table.name) as { c: number };
          if (sqliteTableExists && sqliteTableExists.c > 0) {
            const countRes = sqlite.prepare(`SELECT count(*) as c FROM "${table.name}"`).get() as { c: number };
            sourceCount = countRes.c;
          }
        } catch {
          sourceCount = 0;
        }
      }

      // 2. Check if table exists in PostgreSQL
      try {
        const pgTableRes = await pgClient.query(
          `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)`,
          [table.name],
        );
        const pgTableExists = pgTableRes.rows[0].exists;
        if (!pgTableExists) {
          console.log(
            `${table.name.padEnd(30)} | ${String(sourceCount).padStart(15)} | ${'TABLE MISSING'.padStart(17)} | ❌ Run migrations first`,
          );
          hasErrors = true;
          continue;
        }

        const pgCountRes = await pgClient.query(`SELECT count(*) as c FROM "${table.name}"`);
        targetCountBefore = parseInt(pgCountRes.rows[0].c, 10);
      } catch (err) {
        console.log(
          `${table.name.padEnd(30)} | ${String(sourceCount).padStart(15)} | ${'QUERY ERROR'.padStart(17)} | ❌ ${String(err)}`,
        );
        hasErrors = true;
        continue;
      }

      totalSourceRows += sourceCount;
      totalTargetRows += targetCountBefore;

      if (isVerifyOnly) {
        const match = sourceCount === targetCountBefore;
        const status = match ? '✅ In Sync' : (targetCountBefore > sourceCount ? '⚠️ Target has extra rows' : '❌ Target missing rows');
        console.log(
          `${table.name.padEnd(30)} | ${String(sourceCount).padStart(15)} | ${String(targetCountBefore).padStart(17)} | ${status}`,
        );
        continue;
      }

      if (isDryRun) {
        console.log(
          `${table.name.padEnd(30)} | ${String(sourceCount).padStart(15)} | ${String(targetCountBefore).padStart(17)} | ℹ️ Would migrate ${sourceCount} rows`,
        );
        continue;
      }

      // Live Migration: Read source rows from SQLite and Insert into PostgreSQL
      if (sourceCount > 0 && sqlite) {
        const rows = sqlite.prepare(`SELECT * FROM "${table.name}"`).all() as Record<string, unknown>[];
        for (const row of rows) {
          const keys = Object.keys(row);
          const values: unknown[] = [];
          const placeholders: string[] = [];

          for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            let val = row[key];

            // Normalize boolean columns (SQLite 0/1 to boolean)
            if (table.booleanColumns?.includes(key)) {
              val = val === 1 || val === '1' || val === true;
            }

            // Normalize JSON columns (SQLite strings to objects/JSON string)
            if (table.jsonColumns?.includes(key) && typeof val === 'string' && val.trim() !== '') {
              try {
                val = JSON.parse(val);
              } catch {
                // Keep string if not parseable
              }
            }

            // Normalize Timestamps (SQLite datetime strings to Date or ISO)
            if (table.timestampColumns?.includes(key) && typeof val === 'string' && val.trim() !== '') {
              val = new Date(val);
            }

            values.push(val);
            placeholders.push(`$${i + 1}`);
          }

          const columnsSql = keys.map(k => `"${k}"`).join(', ');
          const valuesSql = placeholders.join(', ');

          // Insert with ON CONFLICT DO NOTHING to ensure idempotency
          await pgClient.query(
            `INSERT INTO "${table.name}" (${columnsSql}) VALUES (${valuesSql}) ON CONFLICT DO NOTHING`,
            values,
          );
        }

        const pgCountAfter = await pgClient.query(`SELECT count(*) as c FROM "${table.name}"`);
        const countAfter = parseInt(pgCountAfter.rows[0].c, 10);
        console.log(
          `${table.name.padEnd(30)} | ${String(sourceCount).padStart(15)} | ${String(countAfter).padStart(17)} | ✅ Migrated`,
        );
      } else {
        console.log(
          `${table.name.padEnd(30)} | ${String(sourceCount).padStart(15)} | ${String(targetCountBefore).padStart(17)} | ℹ️ Empty (skipped)`,
        );
      }
    }

    if (!isDryRun && !isVerifyOnly) {
      if (hasErrors) {
        console.log('\n❌ Errors encountered during migration. Rolling back transaction.');
        await pgClient.query('ROLLBACK');
      } else {
        await pgClient.query('COMMIT');
        console.log('\n✅ Transaction committed successfully!');
      }
    }
  } catch (err) {
    if (!isDryRun && !isVerifyOnly) {
      await pgClient.query('ROLLBACK');
    }
    console.error(`\n❌ Migration failed with error: ${String(err)}`);
    process.exit(1);
  } finally {
    if (mainSqlite) mainSqlite.close();
    if (dataSqlite) dataSqlite.close();
    await pgClient.end();
  }

  console.log('----------------------------------------------------');
  console.log(`Total Source Rows: ${totalSourceRows}`);
  console.log(`Total Target Rows: ${totalTargetRows}`);
  console.log('====================================================\n');
}

run().catch(err => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
