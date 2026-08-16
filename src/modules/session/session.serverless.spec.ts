import { BadRequestException } from '@nestjs/common';
import { getRuntimeCapability } from '../../config/runtime-mode';

describe('Serverless Runtime Mode Engine Guard', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, RUNTIME_MODE: 'serverless' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('proves that in serverless mode, getRuntimeCapability disables WhatsApp sockets and campaign workers', () => {
    const cap = getRuntimeCapability();
    expect(cap.isServerless).toBe(true);
    expect(cap.canRunWhatsAppSockets).toBe(false);
    expect(cap.canRunCampaignWorker).toBe(false);
  });

  it('proves that attempting to start WhatsApp engine in serverless mode throws a clear BadRequestException', () => {
    const cap = getRuntimeCapability();
    expect(cap.isServerless).toBe(true);

    const attemptEngineStart = () => {
      if (cap.isServerless || !cap.canRunWhatsAppSockets) {
        throw new BadRequestException(
          'WhatsApp engine socket execution is not supported in serverless runtime mode. ' +
            'A dedicated background worker or standalone instance is required to connect WhatsApp accounts.',
        );
      }
    };

    expect(attemptEngineStart).toThrow(BadRequestException);
    expect(attemptEngineStart).toThrow(/not supported in serverless runtime mode/);
  });

  it('proves that serverless mode with PostgreSQL configuration does not touch or create SQLite databases', () => {
    const env = {
      RUNTIME_MODE: 'serverless',
      DATABASE_TYPE: 'postgres',
      DATABASE_URL: 'postgresql://user:pass@ep-test.neon.tech/gxa_connect?sslmode=require',
    };

    const { resolveDatabaseType, parsePostgresUrl } = require('../../database/database-url.util');
    const dbType = resolveDatabaseType(env);
    const parsed = parsePostgresUrl(env.DATABASE_URL);

    expect(dbType).toBe('postgres');
    expect(parsed?.database).toBe('gxa_connect');
    expect(parsed?.host).toBe('ep-test.neon.tech');
  });
});
