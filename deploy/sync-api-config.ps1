# Sync Lenovo public_api_url → public/api-config.json on master + gh-pages (no Vite rebuild).
# Run on ASUS (has gh + SSH key). Optional: schedule every 5 min.
param(
  [string]$LenovoHost = 'sa@192.168.1.39',
  [string]$IdentityFile = "$env:USERPROFILE\.ssh\id_samostroy_lenovo",
  [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [string]$GithubRepo = 'puholet-sketch/samostroy',
  [switch]$SkipMaster,
  [switch]$SkipGhPages
)

$ErrorActionPreference = 'Stop'

function Get-LenovoApiUrl {
  $args = @(
    '-i', $IdentityFile,
    '-o', 'IdentitiesOnly=yes',
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=10',
    $LenovoHost,
    'tr -d "[:space:]" < ~/.config/samostroy/public_api_url'
  )
  $url = (& ssh @args).Trim()
  if (-not $url -or $url -notmatch '^https://') {
    throw "Invalid URL from Lenovo: '$url'"
  }
  return $url.TrimEnd('/')
}

function Write-LocalApiConfig([string]$ApiBase) {
  $path = Join-Path $RepoRoot 'public\api-config.json'
  $json = "{`n  `"apiBase`": `"$ApiBase`"`n}`n"
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($path, $json, $utf8NoBom)
  Write-Host "local $path → $ApiBase"
}

function Update-GhPagesFile([string]$ApiBase) {
  $bodyObj = @{ apiBase = $ApiBase }
  $content = ($bodyObj | ConvertTo-Json -Compress) + "`n"
  $b64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($content))
  $sha = $null
  try {
    $meta = gh api "repos/$GithubRepo/contents/api-config.json?ref=gh-pages" | ConvertFrom-Json
    $sha = $meta.sha
  } catch {
    Write-Host "api-config.json missing on gh-pages — creating"
  }
  $payload = @{
    message = "chore: api-config $ApiBase"
    content = $b64
    branch  = 'gh-pages'
  }
  if ($sha) { $payload.sha = $sha }
  $tmp = [IO.Path]::GetTempFileName()
  ($payload | ConvertTo-Json -Compress) | Set-Content -Path $tmp -Encoding utf8
  gh api --method PUT "repos/$GithubRepo/contents/api-config.json" --input $tmp | Out-Null
  Remove-Item $tmp -Force
  Write-Host "gh-pages api-config.json → $ApiBase"
}

function Update-EnvProduction([string]$ApiBase) {
  $envPath = Join-Path $RepoRoot '.env.production'
  if (-not (Test-Path $envPath)) { return }
  $lines = Get-Content $envPath
  $updated = $false
  $out = foreach ($line in $lines) {
    if ($line -match '^VITE_FEEDBACK_API_URL=') {
      $updated = $true
      "VITE_FEEDBACK_API_URL=$ApiBase"
    } else {
      $line
    }
  }
  if (-not $updated) {
    $out = @($out) + "VITE_FEEDBACK_API_URL=$ApiBase"
  }
  $out | Set-Content -Path $envPath -Encoding utf8
  Write-Host ".env.production VITE_FEEDBACK_API_URL → $ApiBase"
}

$apiBase = Get-LenovoApiUrl
Write-Host "Lenovo public URL: $apiBase"

Write-LocalApiConfig $apiBase
Update-EnvProduction $apiBase

if (-not $SkipGhPages) {
  Update-GhPagesFile $apiBase
}

if (-not $SkipMaster) {
  Push-Location $RepoRoot
  try {
    $status = git status --porcelain -- public/api-config.json
    if ($status) {
      Write-Host "public/api-config.json dirty on master — commit separately when ready"
    }
  } finally {
    Pop-Location
  }
}

Write-Host "OK sync-api-config $apiBase"
