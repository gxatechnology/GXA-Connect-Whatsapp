export type RuntimeMode = 'serverless' | 'worker' | 'standalone';

export interface RuntimeCapability {
  mode: RuntimeMode;
  isServerless: boolean;
  canRunWhatsAppSockets: boolean;
  canRunCampaignWorker: boolean;
  canServeApi: boolean;
}

/**
 * Resolves the active runtime mode.
 * - 'serverless': API-only execution (e.g. Vercel, AWS Lambda). Disables Chromium/Baileys sockets and campaign loops.
 * - 'worker': Background long-running stateful process for WhatsApp sockets and campaign batch loops.
 * - 'standalone': Default for local dev and single-server / VM deployments (runs both API and WhatsApp engines).
 */
export function resolveRuntimeMode(env: NodeJS.ProcessEnv = process.env): RuntimeMode {
  const explicit = env.RUNTIME_MODE?.trim().toLowerCase();
  if (explicit === 'serverless' || explicit === 'worker' || explicit === 'standalone') {
    return explicit as RuntimeMode;
  }
  if (env.VERCEL === '1' || env.AWS_LAMBDA_FUNCTION_NAME || env.NETLIFY) {
    return 'serverless';
  }
  return 'standalone';
}

export function getRuntimeCapability(mode: RuntimeMode = resolveRuntimeMode()): RuntimeCapability {
  switch (mode) {
    case 'serverless':
      return {
        mode: 'serverless',
        isServerless: true,
        canRunWhatsAppSockets: false,
        canRunCampaignWorker: false,
        canServeApi: true,
      };
    case 'worker':
      return {
        mode: 'worker',
        isServerless: false,
        canRunWhatsAppSockets: true,
        canRunCampaignWorker: true,
        canServeApi: false,
      };
    case 'standalone':
    default:
      return {
        mode: 'standalone',
        isServerless: false,
        canRunWhatsAppSockets: true,
        canRunCampaignWorker: true,
        canServeApi: true,
      };
  }
}
