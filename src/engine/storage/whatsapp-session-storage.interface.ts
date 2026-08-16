import * as fs from 'fs';
import * as path from 'path';

/**
 * Interface defining session authentication storage operations.
 */
export interface WhatsAppSessionStorage {
  /** Check if authentication credentials exist for a session */
  hasCredentials(sessionId: string): Promise<boolean>;
  /** Clear/delete authentication credentials for a session */
  clearCredentials(sessionId: string): Promise<void>;
  /** Get storage path or locator */
  getStoragePath(sessionId: string): string;
}

/**
 * Local filesystem implementation for standalone or long-running worker deployments.
 */
export class LocalWhatsAppSessionStorage implements WhatsAppSessionStorage {
  constructor(private readonly baseDir: string) {
    if (!fs.existsSync(baseDir)) {
      try {
        fs.mkdirSync(baseDir, { recursive: true });
      } catch {
        // Ignored if cannot create immediately
      }
    }
  }

  async hasCredentials(sessionId: string): Promise<boolean> {
    const sessionPath = path.join(this.baseDir, sessionId);
    return fs.existsSync(sessionPath);
  }

  async clearCredentials(sessionId: string): Promise<void> {
    const sessionPath = path.join(this.baseDir, sessionId);
    if (fs.existsSync(sessionPath)) {
      try {
        await fs.promises.rm(sessionPath, { recursive: true, force: true });
      } catch {
        // Best effort
      }
    }
  }

  getStoragePath(sessionId: string): string {
    return path.join(this.baseDir, sessionId);
  }
}
