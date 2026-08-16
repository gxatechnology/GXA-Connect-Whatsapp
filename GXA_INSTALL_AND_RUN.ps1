$ErrorActionPreference = "Stop"

Write-Host "GXA Connect - verified local build and Docker startup" -ForegroundColor Cyan

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker is not installed or is not available in PATH."
}

$dockerInfo = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    throw "Docker Desktop engine is not running. Start Docker Desktop and retry."
}

Push-Location $PSScriptRoot
try {
    Write-Host "[1/4] Installing dashboard dependencies..." -ForegroundColor Yellow
    Push-Location (Join-Path $PSScriptRoot "dashboard")
    try {
        npm ci
        if ($LASTEXITCODE -ne 0) { throw "npm ci failed" }

        Write-Host "[2/4] Building dashboard..." -ForegroundColor Yellow
        npm run build
        if ($LASTEXITCODE -ne 0) { throw "dashboard build failed" }
    }
    finally {
        Pop-Location
    }

    Write-Host "[3/4] Recreating GXA Connect containers..." -ForegroundColor Yellow
    docker compose down --remove-orphans
    docker rm -f openwa-api openwa-docker-proxy 2>$null | Out-Null
    docker compose up -d --build
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose startup failed" }

    Write-Host "[4/4] Waiting for health check..." -ForegroundColor Yellow
    $healthy = $false
    for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep -Seconds 2
        $status = docker inspect --format='{{.State.Health.Status}}' openwa-api 2>$null
        if ($status -eq 'healthy') { $healthy = $true; break }
        if ($status -eq 'unhealthy') { break }
    }

    docker compose ps
    if (-not $healthy) {
        Write-Warning "Container did not report healthy in time. Run: docker compose logs --tail=200 openwa-api"
    } else {
        Write-Host "GXA Connect is healthy: http://localhost:2785" -ForegroundColor Green
        Start-Process "http://localhost:2785"
    }
}
finally {
    Pop-Location
}
