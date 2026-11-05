# Local Windows setup. Authoring works here; delivery renders go to a pod (docs/RUNPOD.md).
#   powershell -ExecutionPolicy Bypass -File scripts/setup.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host "`n== toolchain ==" -ForegroundColor Cyan
$ok = $true

function Need($name, $cmd) {
  $found = Get-Command $cmd -ErrorAction SilentlyContinue
  if ($found) { Write-Host "ok      $name" -ForegroundColor Green; return $true }
  Write-Host "MISSING $name" -ForegroundColor Red
  return $false
}

$ok = (Need "node" "node") -and $ok
$ok = (Need "npm" "npm") -and $ok
$ok = (Need "ffmpeg" "ffmpeg") -and $ok
$ok = (Need "ffprobe" "ffprobe") -and $ok
$ok = (Need "git" "git") -and $ok

if (Get-Command node -ErrorAction SilentlyContinue) {
  $major = [int]((& node -p "process.versions.node.split('.')[0]"))
  if ($major -lt 22) {
    Write-Host "node is $major.x, need >= 22" -ForegroundColor Red
    $ok = $false
  }
}

if (-not (Get-Command python3 -ErrorAction SilentlyContinue) -and -not (Get-Command python -ErrorAction SilentlyContinue)) {
  Write-Host "MISSING python (needed by ffmpeg-skill)" -ForegroundColor Yellow
}

if (-not $ok) {
  Write-Host "`nInstall what is missing first:" -ForegroundColor Yellow
  Write-Host "  winget install OpenJS.NodeJS.LTS Gyan.FFmpeg Git.Git Python.Python.3.12"
  exit 1
}

Write-Host "`n== npm dependencies ==" -ForegroundColor Cyan
if (Test-Path package-lock.json) { npm ci --no-audit --no-fund } else { npm install --no-audit --no-fund }

Write-Host "`n== headless Chrome ==" -ForegroundColor Cyan
& "$root\node_modules\.bin\hyperframes.cmd" browser ensure
& "$root\node_modules\.bin\remotion.cmd" browser ensure

Write-Host "`n== doctor ==" -ForegroundColor Cyan
node scripts/doctor.mjs
