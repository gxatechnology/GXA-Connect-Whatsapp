import { DataSourceOptions } from 'typeorm';

export interface ParsedPostgresConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  database: string;
  ssl?: boolean | { rejectUnauthorized: boolean };
}

/**
 * Parses a standard PostgreSQL connection URI (e.g. postgresql://user:pass@host:5432/dbname?sslmode=require)
 * into discrete TypeORM PostgreSQL connection parameters.
 */
export function parsePostgresUrl(rawUrl: string): ParsedPostgresConfig | null {
  try {
    const trimmed = rawUrl.trim();
    if (!trimmed.startsWith('postgres://') && !trimmed.startsWith('postgresql://')) {
      return null;
    }

    const parsed = new URL(trimmed);
    const host = parsed.hostname;
    const port = parsed.port ? parseInt(parsed.port, 10) : 5432;
    const username = parsed.username ? decodeURIComponent(parsed.username) : undefined;
    const password = parsed.password ? decodeURIComponent(parsed.password) : undefined;
    const database = parsed.pathname.replace(/^\//, '') || 'postgres';

    const sslmode = parsed.searchParams.get('sslmode');
    let ssl: boolean | { rejectUnauthorized: boolean } | undefined = undefined;

    if (sslmode === 'require' || sslmode === 'verify-ca' || sslmode === 'verify-full' || parsed.searchParams.get('ssl') === 'true') {
      ssl = { rejectUnauthorized: sslmode === 'verify-full' };
    } else if (sslmode === 'disable') {
      ssl = false;
    }

    return {
      host,
      port,
      username,
      password,
      database,
      ssl,
    };
  } catch {
    return null;
  }
}

/**
 * Resolves effective database connection options for the 'main' or 'data' connection.
 */
export function resolveDatabaseType(env: NodeJS.ProcessEnv = process.env): 'postgres' | 'sqlite' {
  if (env.DATABASE_TYPE === 'postgres' || env.DATABASE_URL || env.MAIN_DATABASE_URL || env.DATA_DATABASE_URL) {
    return 'postgres';
  }
  return 'sqlite';
}

/**
 * Main connection entity table names.
 */
export const MAIN_TABLE_NAMES = [
  'users',
  'api_keys',
  'audit_logs',
  'organizations',
  'organization_members',
  'plans',
  'organization_limit_overrides',
  'organization_usage',
] as const;

/**
 * Data connection entity table names.
 */
export const DATA_TABLE_NAMES = [
  'sessions',
  'messages',
  'templates',
  'webhooks',
  'webhook_delivery_failures',
  'crm_leads',
  'crm_notes',
  'crm_tags',
  'crm_lead_tags',
  'crm_followups',
  'crm_activity',
  'message_batches',
  'baileys_stored_messages',
  'lid_mappings',
  'automation_rules',
  'status_updates',
  'conversation_mappings',
  'ingress_events',
  'integration_delivery_failures',
  'plugin_instances',
] as const;

/**
 * Validates that there are no table name collisions between Main and Data entities.
 */
export function checkTableNameCollisions(): string[] {
  const mainSet = new Set<string>(MAIN_TABLE_NAMES);
  const collisions: string[] = [];
  for (const dataTable of DATA_TABLE_NAMES) {
    if (mainSet.has(dataTable)) {
      collisions.push(dataTable);
    }
  }
  return collisions;
}
