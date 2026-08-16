# GXA Connect — Enterprise Foundation

## Product direction
GXA Connect is a self-hosted WhatsApp operations panel built on the existing OpenWA engine. The engine remains responsible for QR sessions and WhatsApp transport. GXA Connect owns the commercial user experience: inbox, contacts, message sending, campaigns, reporting, templates, developer controls, and future reseller tenancy.

## Permanent data rule: ZERO DUMMY DATA
Production UI must never display invented campaign counts, fake contacts, demo revenue, hard-coded message totals, fabricated delivery rates, or sample charts. If a real backend value is unavailable, the UI shows `0`, `—`, or an explicit empty state.

Sources of truth:
- Messages and analytics: persisted message/stat APIs
- WhatsApp accounts: session APIs
- Contacts: live session contacts API
- Campaigns: persisted `message_batches` records
- Campaign delivery reports: persisted per-recipient batch results
- Templates: template API
- Logs: audit API

## Implemented in this build
- Premium GXA-branded navigation grouped by Overview / Communication / Messaging / Analytics / Developer / System.
- Inbox remains the real WhatsApp chat interface and keeps the full-height workspace + fixed emoji popover improvements.
- `WhatsApp Accounts` surfaces the existing real QR/session manager.
- `Message Center` replaces the testing-oriented navigation language while preserving individual, group, media, forward, poll, and bulk capabilities.
- New `Contacts` page reads contacts from the selected connected WhatsApp session, searches them, and exports the real result to CSV.
- New `Campaigns` page:
  - connected-session selector
  - manual recipient entry
  - CSV import
  - format/duplicate counters from the actual input
  - optional WhatsApp-number validation through the existing check-number API
  - campaign name persisted in the backend
  - real async bulk batch start
  - real polling of sent/failed/pending counts
  - cancel action for running batches
  - persistent My Campaigns history from the database
  - recipient-level report viewer
  - CSV report export from stored batch results
- New `Reports` page calculates campaign metrics from persisted batches and message activity from the real stats API.
- Backend `message_batches` now stores an optional human-readable `campaign_name` and exposes a real list endpoint.

## Intentionally NOT faked
The following larger SaaS modules are architecture targets, not pretend UI in this build:
- username/password multi-tenant client login
- reseller hierarchy
- plan/credit billing
- CRM lead pipeline with custom fields
- Redis/BullMQ large-campaign orchestration
- scheduling/drip workflows
- white-label tenant branding

Those require database entities, authorization boundaries, migrations, and end-to-end tests. They should be implemented as backend features before any UI is exposed.

## Recommended next enterprise architecture
Internet -> TLS/Nginx -> GXA Web UI -> GXA NestJS API -> PostgreSQL -> Redis/BullMQ workers -> OpenWA session router -> authorized WhatsApp sessions.

Tenant hierarchy: Super Admin -> Reseller -> Client Organization -> Users. Every tenant-owned table should carry an organization/tenant identifier and server-side authorization checks.

For session failures, normal connectivity failover can route authorized workloads to another healthy account. An account restricted by WhatsApp should be quarantined and the campaign paused for operator review rather than automatically rotating numbers to evade the restriction.
