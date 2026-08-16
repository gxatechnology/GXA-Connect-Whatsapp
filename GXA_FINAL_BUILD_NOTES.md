# GXA Connect — Final Build Notes

This package keeps the existing self-hosted OpenWA backend and QR-session workflow.

## Included UI fixes

- Full-height WhatsApp-style Chats workspace
- Persistent contact list on desktop with independent scrolling
- Wider, usable scrollbars and compact contact rows
- Phone/JID visibility in the active conversation header
- Emoji picker converted to a floating, unclipped popover
- Emoji picker closes on outside click or Escape and returns focus to the composer
- “Message Tester” renamed to “Message Center”
- User-facing copy now describes real individual, group, media and bulk sending

## Build and run

```powershell
cd dashboard
npm ci
npm run build
cd ..
docker compose down
docker compose up -d --build
```

Open: http://localhost:2785

## Safety

The project uses an unofficial WhatsApp Web engine. Use opted-in recipients, conservative rate limits and a dedicated number. No paid third-party connector is required by these changes.
