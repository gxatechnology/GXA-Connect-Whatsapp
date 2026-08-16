# GXA Connect — Final Branding Pass

## Applied
- Uploaded GXA Technologies logo is the source for login branding, sidebar mark, favicon, and Apple touch icon.
- Blank margin was cropped for small-icon readability only; artwork/colors were not redesigned or recolored.
- Browser title: `GXA Connect`.
- Login title: `GXA CONNECT`.
- Login subtitle: `WhatsApp Business Automation Platform`.
- Removed `Need help? View Documentation` and the external OpenWA documentation link.
- Removed OpenWA GitHub icon/link from the login screen.
- Footer: `© 2026 GXA Connect • Powered by GXA Technologies`.
- User-facing dashboard locale wording replaces visible OpenWA branding with GXA Connect.
- Existing upstream LICENSE/source attribution remains in the source package.

## Build note
The source edits are complete. A clean build could not be executed in the assistant sandbox because its internal npm mirror returned a 404 for `zod-validation-error@4.0.2`; run `npm ci` and `npm run build` on the target machine where this project already builds successfully.
