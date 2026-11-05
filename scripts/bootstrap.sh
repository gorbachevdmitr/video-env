#!/usr/bin/env bash
# Idempotent Linux bootstrap for this repo.
# Installs Node 22, a static FFmpeg 6.1+, the shared libraries headless Chrome needs,
# the npm dependencies and both browser builds. Safe to re-run.
#
#   bash scripts/bootstrap.sh                # full setup
#   bash scripts/bootstrap.sh --no-browsers  # author-only (skip ~400 MB of Chrome)
#
# Used in two places: the ChatGPT/Codex cloud container (environment setup command)
# and a RunPod pod (see docs/RUNPOD.md).
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_DIR="$REPO_DIR/.bin"
SKIP_BROWSERS=0
[[ "${1:-}" == "--no-browsers" ]] && SKIP_BROWSERS=1

log() { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m warn\033[0m %s\n' "$*"; }

SUDO=""
if [[ "$(id -u)" -ne 0 ]] && command -v sudo >/dev/null 2>&1; then SUDO="sudo"; fi
export DEBIAN_FRONTEND=noninteractive

mkdir -p "$BIN_DIR"

# ---------------------------------------------------------------- Node 22 ---
node_major() { node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0; }

if ! command -v node >/dev/null 2>&1 || [[ "$(node_major)" -lt 22 ]]; then
  log "Installing Node.js (needs >= 22)"
  NODE_VERSION="${NODE_VERSION:-22.13.1}"
  case "$(uname -m)" in
    x86_64 | amd64) NARCH=x64 ;;
    aarch64 | arm64) NARCH=arm64 ;;
    *) echo "unsupported architecture: $(uname -m)"; exit 1 ;;
  esac
  tmp="$(mktemp -d)"
  curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${NARCH}.tar.xz" -o "$tmp/node.tar.xz"
  mkdir -p "$BIN_DIR/node"
  tar -xJf "$tmp/node.tar.xz" -C "$BIN_DIR/node" --strip-components=1
  rm -rf "$tmp"
else
  log "Node $(node -v) already present"
fi

export PATH="$BIN_DIR/node/bin:$BIN_DIR:$PATH"

# --------------------------------------------------------------- FFmpeg 6+ ---
ffmpeg_major() {
  ffmpeg -version 2>/dev/null | head -1 | sed -E 's/.*version n?([0-9]+)\..*/\1/' || echo 0
}

if ! command -v ffmpeg >/dev/null 2>&1 || [[ "$(ffmpeg_major || echo 0)" -lt 6 ]]; then
  log "Installing static FFmpeg into .bin (full build: libx264, libass, zscale, vidstab)"
  case "$(uname -m)" in
    x86_64 | amd64)
      FFMPEG_URL="${FFMPEG_URL:-https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz}"
      ;;
    aarch64 | arm64)
      FFMPEG_URL="${FFMPEG_URL:-https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linuxarm64-gpl.tar.xz}"
      ;;
    *) echo "unsupported architecture: $(uname -m)"; exit 1 ;;
  esac
  tmp="$(mktemp -d)"
  curl -fsSL "$FFMPEG_URL" -o "$tmp/ffmpeg.tar.xz"
  tar -xJf "$tmp/ffmpeg.tar.xz" -C "$tmp"
  find "$tmp" -type f -name ffmpeg -exec cp {} "$BIN_DIR/ffmpeg" \;
  find "$tmp" -type f -name ffprobe -exec cp {} "$BIN_DIR/ffprobe" \;
  chmod +x "$BIN_DIR/ffmpeg" "$BIN_DIR/ffprobe"
  rm -rf "$tmp"
else
  log "FFmpeg $(ffmpeg_major).x already present"
fi

# ------------------------------------------------------- system libraries ---
APT_FAILED=0
if command -v apt-get >/dev/null 2>&1; then
  log "Installing headless-Chrome runtime libraries (missing ones only)"
  if $SUDO apt-get update -qq >/dev/null 2>&1; then
    log "apt-get update ok"
  else
    APT_FAILED=1
    warn "apt-get update failed — continuing without system packages"
    if [[ "$(id -u)" -ne 0 && -z "$SUDO" ]]; then
      warn "  cause: not root and no sudo here, so Chrome's libraries cannot be installed"
    else
      warn "  cause: package repositories unreachable — check access to archive.ubuntu.com"
    fi
    warn "  if Chrome turns out to be broken, the final doctor run will say so"
  fi
  # Both the pre-24.04 and the 24.04 (t64) package names are listed; failures are tolerated.
  PACKAGES=(
    ca-certificates curl git python3 xz-utils
    libnss3 libnspr4 libatk1.0-0 libatk1.0-0t64 libatk-bridge2.0-0 libcups2 libcups2t64
    libdrm2 libdbus-1-3 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2
    libgbm1 libpango-1.0-0 libcairo2 libasound2 libasound2t64 libatspi2.0-0
    libx11-xcb1 libxcb1 libxext6 libxi6 libxtst6 libgl1
    fonts-liberation fonts-dejavu-core fonts-noto-color-emoji
  )
  for p in "${PACKAGES[@]}"; do
    $SUDO apt-get install -y -qq "$p" >/dev/null 2>&1 || true
  done
else
  APT_FAILED=1
  warn "no apt-get: make sure Chrome's shared libraries are present another way"
fi

# ------------------------------------------------------------------- npm ----
cd "$REPO_DIR"
log "Installing npm dependencies (this is the slow step)"
if [[ -f package-lock.json ]]; then
  npm ci --no-audit --no-fund
else
  npm install --no-audit --no-fund
fi

# --------------------------------------------------------------- browsers ---
# Cloud images usually ship Chromium already. Reusing it skips a ~400 MB download and, more
# importantly, skips a browser whose shared libraries may not exist in this image.
SYSTEM_CHROME=""
for candidate in /usr/bin/chromium /usr/bin/chromium-browser /usr/bin/google-chrome /usr/bin/google-chrome-stable; do
  if [[ -x "$candidate" ]]; then
    SYSTEM_CHROME="$candidate"
    break
  fi
done

if [[ -n "$SYSTEM_CHROME" ]]; then
  log "Using the system browser: $SYSTEM_CHROME"
  export HYPERFRAMES_BROWSER_PATH="$SYSTEM_CHROME"
elif [[ "$SKIP_BROWSERS" -eq 0 ]]; then
  log "No system browser found — downloading headless Chrome"
  "$REPO_DIR/node_modules/.bin/hyperframes" browser ensure || warn "hyperframes browser ensure failed"
  "$REPO_DIR/node_modules/.bin/remotion" browser ensure || warn "remotion browser ensure failed"
fi

# ------------------------------------------------------------- env helper ---
{
  cat <<EOF
# Generated by scripts/bootstrap.sh — source this in a new shell.
export PATH="$BIN_DIR/node/bin:$BIN_DIR:\$PATH"
EOF
  if [[ -n "$SYSTEM_CHROME" ]]; then
    echo "export HYPERFRAMES_BROWSER_PATH=\"$SYSTEM_CHROME\""
  fi
} > "$BIN_DIR/env.sh"
grep -qs ".bin/env.sh" "$HOME/.bashrc" 2>/dev/null || echo "[ -f \"$BIN_DIR/env.sh\" ] && . \"$BIN_DIR/env.sh\"" >> "$HOME/.bashrc"

log "Doctor"
DOCTOR_OUT="$(node scripts/doctor.mjs 2>&1 || true)"
printf '%s\n' "$DOCTOR_OUT"

if printf '%s\n' "$DOCTOR_OUT" | grep -q '! chrome'; then
  warn "Chrome is present but cannot start — almost always missing shared libraries."
  warn "Find them with:"
  warn "  find ~/.cache/hyperframes -name 'chrome-headless-shell' -type f -exec ldd {} \\; | grep 'not found' | sort -u"
  if [[ "$APT_FAILED" -eq 1 ]]; then
    warn "apt-get did not work in this environment, so the libraries were never installed."
    warn "Either give setup root + network, or use an image that already has them."
  fi
fi

cat <<EOF

Setup finished. In a NEW shell (or after: source .bin/env.sh):

  node scripts/render.mjs --all
EOF
