import { resolveRuntimeMode, getRuntimeCapability } from './runtime-mode';
import * as fs from 'fs';
import * as path from 'path';

describe('Runtime Mode & Capabilities', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('resolveRuntimeMode', () => {
    it('detects serverless mode when RUNTIME_MODE=serverless', () => {
      process.env.RUNTIME_MODE = 'serverless';
      expect(resolveRuntimeMode(process.env)).toBe('serverless');
    });

    it('detects serverless mode on Vercel environment (VERCEL=1)', () => {
      delete process.env.RUNTIME_MODE;
      process.env.VERCEL = '1';
      expect(resolveRuntimeMode(process.env)).toBe('serverless');
    });

    it('detects serverless mode on AWS Lambda (AWS_LAMBDA_FUNCTION_NAME)', () => {
      delete process.env.RUNTIME_MODE;
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'my-function';
      expect(resolveRuntimeMode(process.env)).toBe('serverless');
    });

    it('detects worker mode when RUNTIME_MODE=worker', () => {
      process.env.RUNTIME_MODE = 'worker';
      expect(resolveRuntimeMode(process.env)).toBe('worker');
    });

    it('defaults to standalone mode in standard environments', () => {
      delete process.env.RUNTIME_MODE;
      delete process.env.VERCEL;
      delete process.env.AWS_LAMBDA_FUNCTION_NAME;
      delete process.env.NETLIFY;
      expect(resolveRuntimeMode(process.env)).toBe('standalone');
    });
  });

  describe('getRuntimeCapability', () => {
    it('disables WhatsApp engine sockets and campaign workers in serverless mode', () => {
      const cap = getRuntimeCapability('serverless');
      expect(cap.mode).toBe('serverless');
      expect(cap.isServerless).toBe(true);
      expect(cap.canRunWhatsAppSockets).toBe(false);
      expect(cap.canRunCampaignWorker).toBe(false);
      expect(cap.canServeApi).toBe(true);
    });

    it('enables WhatsApp sockets and campaign workers in worker mode', () => {
      const cap = getRuntimeCapability('worker');
      expect(cap.mode).toBe('worker');
      expect(cap.isServerless).toBe(false);
      expect(cap.canRunWhatsAppSockets).toBe(true);
      expect(cap.canRunCampaignWorker).toBe(true);
      expect(cap.canServeApi).toBe(false);
    });

    it('enables all capabilities in standalone mode', () => {
      const cap = getRuntimeCapability('standalone');
      expect(cap.mode).toBe('standalone');
      expect(cap.isServerless).toBe(false);
      expect(cap.canRunWhatsAppSockets).toBe(true);
      expect(cap.canRunCampaignWorker).toBe(true);
      expect(cap.canServeApi).toBe(true);
    });
  });

  describe('Vercel routing configuration (vercel.json)', () => {
    it('ensures /api/* route is first and not captured by SPA fallback', () => {
      const vercelJsonPath = path.resolve(process.cwd(), 'vercel.json');
      expect(fs.existsSync(vercelJsonPath)).toBe(true);

      const content = JSON.parse(fs.readFileSync(vercelJsonPath, 'utf-8'));
      expect(content.routes).toBeDefined();
      expect(content.routes.length).toBeGreaterThan(0);

      const apiRouteIndex = content.routes.findIndex((r: any) => r.src.includes('/api/'));
      const spaFallbackIndex = content.routes.findIndex((r: any) => r.src === '/(.*)' || r.dest?.includes('index.html'));

      expect(apiRouteIndex).toBe(0);
      expect(spaFallbackIndex).toBeGreaterThan(apiRouteIndex);
      expect(content.routes[apiRouteIndex].dest).toContain('api/index.ts');
    });
  });
});
