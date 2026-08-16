# GXA Technologies Dashboard Branding

This build keeps the OpenWA backend and API functionality intact while replacing the dashboard presentation layer with GXA Technologies branding.

## Updated

- GXA Technologies blue, navy and gold visual system
- New GXA logo mark, full logo and favicon
- Rebranded dashboard name: **GXA Connect**
- Premium dark-blue sidebar and responsive mobile header
- Redesigned API-key login screen
- Refined dashboard cards, tables, shadows, spacing and status styling
- Browser titles now use **GXA Technologies**
- OpenWA attribution is retained on the login footer and the original MIT license remains unchanged

## Important

This is still an unofficial WhatsApp gateway powered by OpenWA. The original project warnings about number restrictions, bans and compliance still apply. Use a dedicated WhatsApp number and do not use this as a replacement for Meta's official Cloud API in regulated or critical workflows.

## Run locally

```bash
cd dashboard
npm ci
npm run dev
```

Or from the repository root:

```bash
npm ci
npm run dev
```

The dashboard build could not be executed in the artifact environment because its internal npm mirror did not contain one locked dependency. The branding source files and locale JSON were validated, but you should run `npm ci && npm run build` in your own environment before deployment.
