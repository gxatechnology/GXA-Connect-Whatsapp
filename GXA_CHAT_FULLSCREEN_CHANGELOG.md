# GXA Connect — Full-Screen Chats Upgrade

## Updated
- Chats workspace now fills the remaining browser viewport like WhatsApp Web.
- Removed the nested fixed-height limitation that left a large blank area below the chat panel.
- Contact list and conversation pane now scroll independently.
- Contact panel is responsive (340–420px desktop) and remains visible while a conversation is open.
- Session selector, tabs, and search controls are more compact.
- Contact rows are compact and now always show the WhatsApp phone/identifier plus last-message preview.
- Conversation header and composer remain fixed while the message thread uses the remaining height.
- Mobile keeps a single-pane list/conversation flow with the back button.

## Files changed
- `dashboard/src/pages/Chats.css`
- `dashboard/src/components/chats/ChatSidebar.tsx`

## Local verification
```powershell
cd dashboard
npm ci
npm run build
```

The source changes were reviewed in this package. A build could not be executed in the packaging environment because its internal npm mirror did not contain `zod-validation-error@4.0.2`; this is an environment registry limitation, not a TypeScript error reported by the project.
