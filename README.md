# video-env

Одна среда для производства видео силами кодового агента (ChatGPT/Codex Web) с рендером на RunPod.

Идея в одном предложении: **ролик пишется в облаке, а рендерится на поде.** Codex Web умеет
читать репозиторий, писать HTML/React и проверять кадры, но не умеет отдавать тяжёлые файлы и
рендерить 1080p за секунды. RunPod умеет рендерить, но не умеет придумывать. Репозиторий — это
стык: он одинаково поднимается в обоих местах одной командой.

```
ChatGPT / Codex Web                    GitHub                     RunPod
┌──────────────────────┐            ┌──────────┐            ┌────────────────────┐
│ читает AGENTS.md     │  commit    │  repo    │   clone    │ bash bootstrap.sh  │
│ пишет композицию     │ ─────────► │          │ ─────────► │ node render.mjs    │
│ check + snapshot     │            │          │            │ mp4 + contact sheet│
└──────────────────────┘            └──────────┘            └────────────────────┘
```

## Пять репозиториев — одна среда

| Источник | Роль в среде | Как встроен |
| --- | --- | --- |
| [kajisho5/ffmpeg-skill](https://github.com/kajisho5/ffmpeg-skill) | Руки: резка, кроп, субтитры, громкость, выгрузка под платформы, проверка результата | Вендорен в `.agents/skills/ffmpeg-skill` (Python-скрипты + контракт) |
| [latent-spaces/brag](https://github.com/latent-spaces/brag) | Скилл сторителлинга: превращает продукт/репо в короткий launch-ролик | Вендорен в `.agents/skills/brag` и `brag-slim` (вместе с CC-музыкой и SFX) |
| [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes) | Движок №1: HTML + seekable-анимация → MP4, кадр в кадр | npm-пакет `hyperframes@0.9.13` + 4 скилла в `.agents/skills` |
| [remotion-dev/remotion](https://github.com/remotion-dev/remotion) | Движок №2: React-композиции, генерация из данных | npm-пакеты `remotion` и `@remotion/cli` + рабочий шаблон |
| [reactvideoeditor/remotion-templates](https://github.com/reactvideoeditor/remotion-templates) | 81 готовый компонент (MIT): графики, счётчики, титры, переходы, фоны, логотипы | Вендорен в `.agents/skills/remotion-templates` + `scripts/add-component.mjs` |

Почему не git submodule: поду и облаку нужен один `git clone` без рекурсии и без прав на чужие
репозитории. Поэтому скиллы лежат копиями (их SHA зафиксированы в [docs/VENDOR.md](docs/VENDOR.md)),
а движки ставятся из npm по `package-lock.json`.

## Что умеет агент после подключения

- «Сделай 15-секундный ролик про мой продукт» → скилл `brag` → HyperFrames.
- «Объяснялка с графиком и титрами» → скилл `hyperframes` → HyperFrames.
- «Сгенерируй 20 вариантов из CSV» → Remotion.
- «Нужен счётчик цифр, лоуэр-сёрд и переход» → Remotion + `scripts/add-component.mjs` (81 готовый компонент).
- «Нарежь это интервью, убери паузы, сделай вертикаль под Reels» → `ffmpeg-skill`.
- «Проверь готовый mp4 и выгрузи под TikTok» → `ffmpeg-skill` (`check.py`, `export.py`).

## Быстрый старт

### 1. Выложить репозиторий на GitHub

```bash
cd video-env
git init -b main
git add -A
git commit -m "video-env: initial environment"
git remote add origin https://github.com/gorbachevdmitr/video-env.git
git push -u origin main
```

Репозиторий весит ~21 МБ: внутри вендоренные скиллы, 81 Remotion-компонент, музыка и SFX.
`node_modules/`, `out/` и `.bin/` в git не попадают — они ставятся командами ниже.

### 2. Подключить в ChatGPT / Codex Web

В Codex → **Environments** → **Create environment**:

1. Репозиторий: `<вы>/video-env`.
2. **Setup script**: `bash scripts/bootstrap.sh`
   Скрипт ставит Node 22, статический FFmpeg 6.1+, библиотеки для headless Chrome, `npm ci`
   и оба браузера. Идемпотентен: повторный запуск ничего не ломает.
3. Переменные окружения — не обязательны. Если рендер будете запускать и в облаке тоже,
   добавьте `HYPERFRAMES_TELEMETRY=0`.

Если в облаке запрещён сетевой доступ на уровне allowlist, разрешите:
`registry.npmjs.org`, `nodejs.org`, `github.com` (релизы FFmpeg), `storage.googleapis.com`
(сборки Chrome), `cdn.playwright.dev`.

### 3. Попросить ролик

Пишите как человеку, а не как CLI:

```
Сделай 12-секундный launch-ролик про этот репозиторий: 16:9, 1080p30,
тёмный фон, жёлтый акцент, три сцены, титры по-русски.
```

Агент сам выберет движок, прочитает нужный `SKILL.md`, прогонит `check` и `snapshot`, положит
всё в `videos/<slug>/` и допишет `video.json`. Готовые формулировки — [docs/PROMPTS.md](docs/PROMPTS.md).

### 4. Отрендерить на RunPod

Коротко (подробно — [docs/RUNPOD.md](docs/RUNPOD.md)):

```bash
git clone https://github.com/gorbachevdmitr/video-env.git && cd video-env
bash scripts/bootstrap.sh          # ~4-6 минут, один раз на поде
node scripts/render.mjs --all      # -> out/<slug>.mp4 + contact sheet
runpodctl send out/<slug>.mp4      # код -> runpodctl receive <код> дома
```

## Проверить локально (Windows/macOS/Linux)

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup.ps1   # Windows
bash scripts/bootstrap.sh                                    # Linux/macOS
node scripts/doctor.mjs
node scripts/smoke.mjs
```

`smoke` рендерит оба примера в `out/` в черновом качестве — если он зелёный, среда живая.

## Что уже проверено

| Проверка | Результат |
| --- | --- |
| `videos/hello` (HyperFrames, 5 с, 1080p30) | `check`: 0 ошибок; рендер 26 с на 4-ядерном ноутбуке |
| `videos/hello-remotion` (Remotion, 5 с) | `tsc --noEmit` чисто; рендер 14 с в 540p |
| `templates/hyperframes` (3 сцены, 12 с) | `check`: 0 ошибок, 0 предупреждений; рендер 44 с |
| `remotion-templates` (81 компонент) | `stat-counter` + `lower-third` подключены и отрендерены: `tsc` чисто, кадр верный |
| `videos/showcase` (15 с, 5 компонентов) | `check` 1/1, черновой рендер 26 с, контактный лист сходится с раскадровкой |
| `ffmpeg-skill` (`probe.py`, `look.py`) | работают на Python 3.14 и на результате рендера |
| Чистый `git clone` + `npm ci` + `node scripts/smoke.mjs` | проходит без локальных артефактов |

## Структура

| Путь | Назначение |
| --- | --- |
| `AGENTS.md` | Контракт для агента: какой движок, какой цикл, что нельзя |
| `videos/<slug>/` | Ролики: композиция + `video.json` (манифест рендера) |
| `videos/showcase/` | Эталон Remotion-ролика: 5 компонентов, один бренд, фейды между сценами |
| `templates/hyperframes/` | Скелет HTML-ролика: 3 сцены, титры, бренд-переменные |
| `templates/remotion/` | Скелет React-ролика |
| `.agents/skills/` | Вендоренные скиллы (8 штук, включая 81 Remotion-компонент) |
| `scripts/` | `bootstrap`, `doctor`, `check`, `render`, `new-video`, `smoke` |
| `docs/` | [RunPod-рецепт](docs/RUNPOD.md), [промпты](docs/PROMPTS.md), [учёт вендоренных версий](docs/VENDOR.md) |
| `out/` | Результаты рендера (в git не попадает) |

## Как проверяется, что ролик готов

Три гейта, все машинные:

1. `node scripts/check.mjs` — `hyperframes check` (lint + runtime + layout + contrast) и сверка
   длительности в `video.json` с фактической композицией.
2. `npx hyperframes snapshot --at ...` — PNG-кадры; агент обязан их посмотреть, а не поверить чеку.
3. `node scripts/render.mjs` — рендер + `ffprobe` + контактный лист `out/<slug>.contact.png`.

## Ограничения, которые лучше знать заранее

- **1080p30, ≤60 с.** Рендер идёт headless Chrome + libx264 на CPU. 30 секунд — это минута-две на
  8 vCPU; пятиминутный ролик на поде — это уже деньги и таймауты.
- **GPU не нужен.** Рендер не использует CUDA; берите CPU-под (дешевле), GPU-под оправдан только
  если параллельно гоняете генерацию картинок/видео моделями.
- **Агент не видит видео.** Только кадры и контактные листы. Поэтому в контракте `snapshot` —
  обязательный шаг, а не рекомендация.
- **`out/` не коммитится.** Файл забирают с пода; если очень нужно — GitHub Releases, а не git.
- **Версии запинены.** Под рендерит тем же деревом зависимостей, что и облако. Менять
  `package.json` без причины — значит получить «в облаке красиво, на поде иначе».

## Обновление вендоренных скиллов

См. [docs/VENDOR.md](docs/VENDOR.md): там SHA каждого источника и точный список того, что
вырезано при вендоринге.
