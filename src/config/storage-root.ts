import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { isServerlessEnvironment } from './load-env';

/** Storage root used when STORAGE_LOCAL_PATH is unset. Mirrors configuration.ts's `storage.localPath`. */
export const DEFAULT_STORAGE_ROOT = './data/media';

/**
 * Storage roots no operator ever chose: `GET /infra/status` read a config key that never existed
 * (`storage.path`) and returned this fallback on every request in v0.2.0–v0.7.3, so any dashboard
 * Infrastructure save in that window persisted it to `data/.env.generated` — which lives on the data
 * volume and survives every upgrade (#472 fixed the endpoint, nothing migrated the stored value).
 *
 * Both spellings are listed because `path.join` normalises `./uploads` to `uploads`, so the value can
 * be observed either way depending on which layer wrote it.
 */
const FOSSIL_STORAGE_ROOTS = new Set(['./uploads', 'uploads']);

/** Minimal logger surface (satisfied by createLogger()'s result). */
export interface StorageRootLogger {
  warn: (message: string) => void;
}

export interface StorageRootOptions {
  /** Raw STORAGE_LOCAL_PATH. Blank/undefined falls back to {@link DEFAULT_STORAGE_ROOT}. */
  configured?: string;
  /** Injectable for tests; defaults to the real filesystem probe. */
  isWritable?: (root: string) => boolean;
  logger?: StorageRootLogger;
  /** Explicit serverless flag override; defaults to detecting serverless runtime */
  isServerless?: boolean;
}

/**
 * Whether the storage root can actually be written to, creating it when missing.
 *
 * This deliberately probes WRITABILITY, not existence. StorageService's own boot check is
 * `if (!existsSync(root)) mkdirSync(root)` — which is a silent no-op for a root that exists but is
 * owned by another user, so the failure only surfaces later, on the first media write (#1065).
 */
export function isStorageRootWritable(root: string): boolean {
  try {
    fs.mkdirSync(root, { recursive: true });
    fs.accessSync(root, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve the effective storage root, failing fast when it is unusable.
 *
 * In serverless environments (Vercel/AWS Lambda), `/var/task` is read-only. When the configured
 * path is not writable, temporary storage safely resolves under `os.tmpdir()` (typically `/tmp/media`).
 *
 * In standalone environments, an unwritable fossil is migrated onto `./data/media`, and any other
 * unwritable root throws fast.
 */
export function resolveStorageRoot(options: StorageRootOptions): string {
  const isServerless = options.isServerless ?? isServerlessEnvironment(process.env);
  const isWritable = options.isWritable ?? isStorageRootWritable;
  const configured = options.configured?.trim() || (isServerless ? path.join(os.tmpdir(), 'media') : DEFAULT_STORAGE_ROOT);

  if (isWritable(configured)) return configured;

  if (isServerless) {
    const tmpRoot = path.join(os.tmpdir(), 'media');
    if (isWritable(tmpRoot)) return tmpRoot;
  }

  if (FOSSIL_STORAGE_ROOTS.has(configured) && isWritable(DEFAULT_STORAGE_ROOT)) {
    options.logger?.warn(
      `STORAGE_LOCAL_PATH='${configured}' is not writable and is a known-bad value written by a bug in ` +
        `OpenWA v0.2.0–v0.7.3 (#472); falling back to '${DEFAULT_STORAGE_ROOT}'. Remove the STORAGE_LOCAL_PATH ` +
        `line from data/.env.generated to silence this warning. Any media previously written to ` +
        `'${configured}' was outside the data volume and is not recoverable.`,
    );
    return DEFAULT_STORAGE_ROOT;
  }

  throw new Error(
    `Refusing to start: the media storage root is not writable.\n` +
      `  STORAGE_LOCAL_PATH = ${configured}\n` +
      `  resolved to        = ${path.resolve(configured)}\n` +
      `  running as uid     = ${typeof process.getuid === 'function' ? process.getuid() : 'n/a'}\n` +
      `Point STORAGE_LOCAL_PATH at a directory the app can write to (in Docker, keep it inside the ` +
      `mounted data volume — e.g. ${DEFAULT_STORAGE_ROOT}).`,
  );
}

