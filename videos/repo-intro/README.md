# Repository intro
1920x1080, 30 fps, exactly 10 seconds (300 frames). Three Russian titles.

## Validate and draft locally
From the repository root:
```bash
node scripts/check.mjs repo-intro
HYPERFRAMES_BROWSER_PATH=/usr/bin/chromium node scripts/render.mjs repo-intro --quality draft
```
The browser override uses the cloud image's installed Chromium when downloading headless-shell is unavailable.

## Final render on RunPod
Follow docs/RUNPOD.md, then from the repository root:
```bash
node scripts/render.mjs repo-intro --quality looks
```
Music attribution is in MUSIC-CREDITS.md. Dependencies and vendored skills are unchanged.
