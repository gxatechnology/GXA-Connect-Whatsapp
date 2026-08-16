# GXA Connect Runbook

## Build dashboard
```powershell
cd "<PROJECT>\dashboard"
npm ci
npm run build
```

## Build and run complete Docker stack
```powershell
cd "<PROJECT>"
docker rm -f openwa-api openwa-docker-proxy 2>$null
docker compose up -d --build
docker compose ps
```

Expected state: `openwa-api` is `healthy` and `openwa-docker-proxy` is `Up`.

Dashboard: `http://localhost:2785`
API docs: `http://localhost:2785/api/docs`

## API key
```powershell
docker exec openwa-api sh -c "cat data/.api-key"
```

## Production note
For public hosting use a Linux VPS with Docker and HTTPS reverse proxy. Do not expose the dashboard or MCP/API endpoints to the public Internet without authentication and TLS.
