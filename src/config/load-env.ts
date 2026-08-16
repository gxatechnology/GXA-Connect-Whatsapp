import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { writeSecretFile } from '../common/utils/secret-file';
import { clearBlankEnv, recordOsEnvKeys, recordPinnedEnvKeys, BLANK_SHADOWED_ENV_KEYS } from './env-precedence';

/**
 * Detects if the current process is running in a serverless environment (e.g. Vercel, AWS Lambda, Netlify).
 */
export function isServerlessEnvironment(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    env.RUNTIME_MODE === 'serverless' ||
    env.VERCEL === '1' ||
    !!env.VERCEL_ENV ||
    !!env.AWS_LAMBDA_FUNCTION_NAME ||
    !!env.LAMBDA_TASK_ROOT ||
    !!env.NETLIFY
  );
}

/**
 * Load configuration into process.env BEFORE any application module is imported.
 *
 * Loading order (later sources do NOT override earlier ones):
 *   1. Process env (Docker, shell, systemd, Vercel/Lambda) — highest priority
 *   2. .env (project-level overrides committed/managed by the user)
 *   3. data/.env.generated (Dashboard-managed config; created on first run in standalone mode)
 *
 * In serverless mode (Vercel, AWS Lambda):
 *   - NEVER attempt to create or write persistent directories under /var/task or project root.
 *   - Environment variables are supplied directly by the serverless platform in process.env.
 */
export function loadEnvironment(): void {
  const isServerless = isServerlessEnvironment(process.env);

  if (isServerless) {
    if (!process.env.RUNTIME_MODE) {
      process.env.RUNTIME_MODE = 'serverless';
    }

    clearBlankEnv(process.env, BLANK_SHADOWED_ENV_KEYS);
    recordOsEnvKeys(process.env);

    // Read user-managed .env only if it physically exists (read-only, no directory creation)
    const userEnvPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(userEnvPath)) {
      dotenv.config({ path: userEnvPath, override: false });
    }

    recordPinnedEnvKeys(process.env);
    return;
  }

  // Standalone / Local development mode:
  const generatedEnvPath = path.resolve(process.cwd(), 'data', '.env.generated');
  const userEnvPath = path.resolve(process.cwd(), '.env');

  // Ensure data directory exists
  const dataDir = path.dirname(generatedEnvPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Tighten any pre-existing secret files written before per-file 0600 perms (best-effort) — the
  // generated .env holds S3/DB/Redis secrets and .api-key holds the raw admin key.
  for (const secret of [generatedEnvPath, path.resolve(dataDir, '.api-key')]) {
    if (fs.existsSync(secret)) {
      try {
        fs.chmodSync(secret, 0o600);
      } catch {
        /* best-effort */
      }
    }
  }

  // A compose `- KEY=${KEY:-}` line forwards a real operator value into the container but renders an
  // empty value when none is set. An empty process.env.KEY would still block .env / .env.generated
  // (loaded below with override:false) from supplying one, silently shadowing the dashboard's saved
  // value — so treat a blank value as unset for every dashboard-managed, blank-forwarded key (engine
  // selection and the external-Postgres password).
  clearBlankEnv(process.env, BLANK_SHADOWED_ENV_KEYS);

  // Snapshot what the HOST supplied, before the two file layers below are merged in. Afterwards a
  // file value is indistinguishable from an orchestrator override — both just sit in process.env —
  // so anything asking "is this key overridden?" (the save-config boot guard) needs this record.
  recordOsEnvKeys(process.env);

  // 2. User-managed .env (does not override real process env)
  if (fs.existsSync(userEnvPath)) {
    console.log('[Bootstrap] Loading .env from:', userEnvPath);
    dotenv.config({ path: userEnvPath, override: false });
  }

  // Snapshot the layers that will SHADOW the dashboard-saved file — process env plus the .env just
  // merged above. Taken here rather than reconstructed later because once the file is merged in, all
  // three layers are indistinguishable inside process.env, and the Infrastructure page needs to tell
  // "an environment variable pins this" apart from "saved, pending a restart" (#1082).
  recordPinnedEnvKeys(process.env);

  // 3. Dashboard-saved config (does not override .env or process env)
  if (fs.existsSync(generatedEnvPath)) {
    console.log('[Bootstrap] Loading saved configuration from:', generatedEnvPath);
    dotenv.config({ path: generatedEnvPath, override: false });
  } else {
    console.log('[Bootstrap] First run detected, creating default configuration...');
    // Create minimal .env.generated with sensible defaults
    const minimalConfig = `# OpenWA Configuration
# Generated automatically on first run
# Edit via Dashboard > Infrastructure or modify this file directly.
# Note: values in process env or project .env take precedence over this file.

# Database (SQLite - no external service required)
DATABASE_TYPE=sqlite
POSTGRES_BUILTIN=false

# Redis & Queue (disabled by default)
REDIS_ENABLED=false
REDIS_BUILTIN=false
QUEUE_ENABLED=false

# Storage (Local filesystem)
STORAGE_TYPE=local
MINIO_BUILTIN=false
STORAGE_LOCAL_PATH=./data/media

# Docker Profiles: none (minimal setup)
`;
    writeSecretFile(generatedEnvPath, minimalConfig);
    console.log('[Bootstrap] Created default configuration at:', generatedEnvPath);
    dotenv.config({ path: generatedEnvPath, override: false });
  }
}

// Run immediately on import so process.env is populated before any other module is evaluated.
loadEnvironment();

