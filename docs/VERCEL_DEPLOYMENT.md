# GXA Connect — Vercel Production Deployment Guide

This guide outlines the production deployment architecture, step-by-step setup, and operational considerations for hosting **GXA Connect** on **Vercel** with a **Managed PostgreSQL** database and **S3-compatible Object Storage**.

---

## 1. Architectural Model & Runtime Boundaries

| Component | Target Runtime | Capability / Role |
| :--- | :--- | :--- |
| **Frontend Dashboard (SPA)** | Vercel Edge / CDN | React dashboard compiled to static assets served globally with instant CDN caching. |
| **REST API Server** | Vercel Serverless Functions | NestJS API endpoints (`/api/*`), Multi-Tenant Auth, CRM, Organization & Plan Management. |
| **Database** | Managed PostgreSQL (Neon / Supabase / AWS RDS) | Relational multi-tenant persistent storage for users, orgs, chats, messages, CRM leads, campaigns. |
| **Media & File Storage** | S3 / Cloudflare R2 / AWS S3 | Durable object storage for message attachments, avatars, and media files. |
| **WhatsApp Socket Engine** | Dedicated Background Worker (VM / Container) | Persistent long-running process maintaining live Baileys / WhatsApp WebSocket connections. |

> [!IMPORTANT]
> **Serverless Execution Boundaries:**
> Vercel Serverless Functions are stateless and ephemeral. They are ideal for serving the React Dashboard and REST API endpoints. However, persistent WhatsApp WebSockets (Baileys) and headless browser sessions (Chromium/whatsapp-web.js) require a continuous network connection and must be run on a dedicated worker or standalone server process.

---

## 2. Pre-Deployment Prerequisites

1. **GitHub Repository**: Push source code to your repository (e.g. `gxatechnology/GXA-Connect-Whatsapp`).
2. **Managed PostgreSQL Database**: Provision a managed database (Neon, Supabase, AWS RDS PostgreSQL).
3. **S3-Compatible Bucket**: Create a storage bucket on Cloudflare R2 or AWS S3.
4. **Vercel Account**: Linked to your GitHub repository.

---

## 3. Database Schema Setup & Migration

Before launching the application on Vercel, the database schema must be initialized.

### A. Run PostgreSQL Migrations
Set `DATABASE_URL` in your terminal and execute:
```bash
export DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require"

# 1. Run main connection migrations (Users, Orgs, Plans, API Keys, Audit Logs)
npm run migration:run:main

# 2. Run data connection migrations (Sessions, Messages, CRM, Batches)
npm run migration:run
```

### B. Migrate Existing SQLite Data to PostgreSQL (Non-Destructive)
To transfer existing local real data (`./data/main.sqlite` and `./data/openwa.sqlite`) to PostgreSQL:

1. **Simulate (Dry Run):**
   ```bash
   npx ts-node scripts/migrate-sqlite-to-postgres.ts --dry-run
   ```
2. **Perform Migration:**
   ```bash
   npx ts-node scripts/migrate-sqlite-to-postgres.ts
   ```
3. **Verify Counts:**
   ```bash
   npx ts-node scripts/migrate-sqlite-to-postgres.ts --verify-only
   ```

---

## 4. Configuring Vercel Project

1. Import the Git repository in the Vercel Dashboard.
2. In **Project Settings** → **Build & Development Settings**:
   - **Framework Preset**: Other
   - **Build Command**: `npm run build && npm --prefix dashboard run build`
   - **Output Directory**: `dashboard/dist`
3. In **Project Settings** → **Environment Variables**, configure:

| Variable | Description | Example Value |
| :--- | :--- | :--- |
| `NODE_ENV` | Application environment | `production` |
| `RUNTIME_MODE` | Runtime execution mode | `serverless` |
| `DATABASE_TYPE` | Database driver | `postgres` |
| `DATABASE_URL` | PostgreSQL connection URL | `postgresql://user:pass@ep-xyz.neon.tech/dbname?sslmode=require` |
| `AUTH_SESSION_SECRET` | 32+ char cryptographic secret | `openssl rand -base64 32` |
| `CORS_ORIGIN` | Allowed dashboard domains | `https://your-app.vercel.app` |
| `STORAGE_TYPE` | Media storage provider | `s3` |
| `S3_BUCKET` | Bucket name | `gxa-connect-media` |
| `S3_REGION` | Bucket region | `us-east-1` |
| `S3_ACCESS_KEY` | Access key | `AKIA...` |
| `S3_SECRET_KEY` | Secret key | `...` |
| `ADMIN_EMAIL` | Bootstrap Admin Email | `admin@yourdomain.com` |
| `ADMIN_PASSWORD` | Bootstrap Admin Password | `...` |
| `ADMIN_FULL_NAME` | Bootstrap Admin Name | `Platform Super Administrator` |

---

## 5. Health & Readiness Verification

After deployment, test the health check endpoints:
- `GET /api/health` — Returns basic service status and runtime capability mode (`serverless`).
- `GET /api/health/ready` — Verifies database connection readiness.

---

## 6. Routing & Asset Architecture

The routing defined in `vercel.json` ensures:
1. All `/api/*` traffic is routed directly to the NestJS serverless handler (`api/index.ts`).
2. Static dashboard bundles (`/assets/*`, `/favicon.ico`) are served directly by the Vercel Edge CDN.
3. Dashboard client-side SPA routing (`/*`) falls back cleanly to `index.html`.
