# Вендоренные источники

Скиллы лежат в репозитории копиями, а не сабмодулями: под и облако должны получать всё одним
`git clone` без рекурсии и без доступа к чужим репозиториям. Здесь зафиксировано, что и откуда взято.

| Скилл | Источник | Commit |
| --- | --- | --- |
| `ffmpeg-skill` | https://github.com/kajisho5/ffmpeg-skill | `1ce2c186bf1dba96132d87274eee46df4f537e0e` |
| `brag` | https://github.com/latent-spaces/brag | `669ab9286aa28b6c3ee30e75f181ee74319d012a` |
| `brag-slim` | https://github.com/latent-spaces/brag | `669ab9286aa28b6c3ee30e75f181ee74319d012a` |
| `hyperframes` | https://github.com/heygen-com/hyperframes | `0.9.13` (пакет + скиллы одной версии) |
| `hyperframes-cli` | https://github.com/heygen-com/hyperframes | `0.9.13` |
| `hyperframes-registry` | https://github.com/heygen-com/hyperframes | `0.9.13` |
| `media-use` | https://github.com/heygen-com/hyperframes | `0.9.13` |
| `remotion-templates` | https://github.com/reactvideoeditor/remotion-templates | `6209b724798e48ff395f8df1a6fa2d26082372b5` |

## Что вырезано при вендоринге

Копии урезаны, чтобы репозиторий оставался ~20 МБ и не тянул гигабайты демо-медиа.

**ffmpeg-skill** — оставлено: `SKILL.md`, `scripts/`, `templates/`, `references/`, `mcp/`,
`docs/*.md`, `package.json`, `LICENSE`.
Вырезано: `assets/`, `site/`, `demos/`, `tests/`, `evals/`, `brand/`, `docs/demos/*` (GIF и mp4),
`CHANGELOG.md`, `README.md` (он на 100 КБ и не нужен агенту).

**brag** — оставлено: `skills/brag/` целиком (включая CC-музыку и SFX), `skills/brag-slim/`.
Вырезано: `docs/`, `examples/`, `.github/`, манифесты плагинов.

**hyperframes** — никакого кода в репозитории нет: движок ставится как npm-пакет `hyperframes`,
а скиллы скопированы из установленного пакета той же версии.

**remotion-templates** — ничего не вырезано: все 81 компонент лежат как есть (`components/*.tsx`,
байт в байт из upstream). Добавлены только `SKILL.md`, `catalog.json`, `LICENSE` и `NOTICE.md` —
MIT требует сохранять копирайт при распространении. Два файла (`parallax-pan.tsx`,
`zoom-pulse.tsx`) импортируют `next/image` и в чистом Remotion-проекте требуют замены на `<img>`;
это отмечено в `catalog.json` (`requiresAdaptation`) и в `SKILL.md`.

## Обновить

```bash
# 1. свежие исходники во временную папку
tmp=$(mktemp -d)
git clone --depth 1 https://github.com/kajisho5/ffmpeg-skill "$tmp/ffmpeg-skill"
git clone --depth 1 https://github.com/latent-spaces/brag "$tmp/brag"

# 2. заменить только то, что оставлено (см. список выше)
#    ffmpeg-skill: SKILL.md scripts/ templates/ references/ mcp/ docs/*.md package.json LICENSE
#    brag:         skills/brag/ skills/brag-slim/

# 3. обновить таблицу SHA в этом файле
git -C "$tmp/ffmpeg-skill" rev-parse HEAD
git -C "$tmp/brag" rev-parse HEAD

# 4. проверить, что среда жива
node scripts/doctor.mjs && node scripts/smoke.mjs
```

Для HyperFrames проще: `npx hyperframes@latest upgrade --project . --check`, затем поднять
версию в `package.json` и заново скопировать четыре скилла через `npx hyperframes skills update`
в отдельную папку, откуда их можно забрать в `.agents/skills/`.
