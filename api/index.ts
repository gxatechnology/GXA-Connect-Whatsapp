// Vercel Serverless Function entrypoint for GXA Connect API
import '../src/config/load-env';

// Force serverless runtime mode
process.env.RUNTIME_MODE = 'serverless';

import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import { applyGlobalValidation } from '../src/config/app-validation';
import { resolveCorsPolicy, resolveBodyLimit } from '../src/config/bootstrap-security';
import { requestContextMiddleware } from '../src/common/middleware/request-context.middleware';
import helmet from 'helmet';
import express, { Request, Response, json, urlencoded } from 'express';

const server = express();
let isInitialized = false;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    logger: ['error', 'warn', 'log'],
    bodyParser: false,
  });

  const bodyLimit = resolveBodyLimit(process.env.BODY_LIMIT, 'production');
  server.use(json({ limit: bodyLimit }));
  server.use(urlencoded({ extended: true, limit: bodyLimit }));

  server.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  const cors = resolveCorsPolicy(process.env.CORS_ORIGIN, process.env.NODE_ENV);
  server.use((req, res, next) => {
    const origin = req.headers.origin as string | undefined;
    if (cors.allowAnyOrigin) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    } else if (origin && cors.origins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Accept, Authorization, X-API-Key, X-Request-ID, X-Organization-ID',
    );

    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  server.use(requestContextMiddleware());
  applyGlobalValidation(app);

  await app.init();
  isInitialized = true;
}

export default async function handler(req: Request, res: Response) {
  if (!isInitialized) {
    await bootstrap();
  }
  server(req, res);
}
