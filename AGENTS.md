# video-env — контракт для агента

Ты внутри самодостаточного окружения для производства видео. Здесь есть всё, чтобы **написать**
ролик, и ничего, что нужно досоздавать руками. Рендер тяжёлых файлов идёт на отдельной машине
(RunPod), поэтому твоя работа — довести композицию до состояния «рендерится с первого раза».

Пользователь пишет по-русски — отвечай по-русски. Файлы, код и комментарии — на английском.

## 1. Жёсткие правила

- Node.js >= 22, FFmpeg >= 6.1 и Python >= 3.10 уже стоят. Первый запуск в сессии — `node scripts/doctor.mjs`.
- **Здесь не рендерят финал.** `node scripts/render.mjs <slug>` на этой машине — только `--quality draft`
  для проверки движения. Финальный рендер делает пользователь на поде по `docs/RUNPOD.md`.
- Не коммить `node_modules/`, `out/`, `.hyperframes/`, `.bin/`. Не коммить `.mp4`, если об этом не просили.
- Всё видимое в кадре — функция времени таймлайна. Запрещено: `Date.now()`, незасеянный `Math.random()`,
  сетевые запросы во время рендера, `setTimeout`, `repeat: -1`, анимации по `left/top/width/height`.
- Внешние CDN в композициях запрещены: GSAP и шрифты — только локально из `assets/vendor/` и `assets/fonts/`.
- Один ролик = одна папка в `videos/<slug>/` со своим `video.json`. Без `video.json` ролик не рендерится.

## 2. Что где лежит

| Путь | Что это |
| --- | --- |
| `videos/<slug>/` | Ролики. `video.json` — манифест, по нему рендерит под |
| `templates/hyperframes/` | Рабочий скелет HTML-ролика (3 сцены, титры, переменные) |
| `templates/remotion/` | Рабочий скелет React-ролика |
| `.agents/skills/` | Вендоренные скиллы: `hyperframes`, `hyperframes-cli`, `hyperframes-registry`, `media-use`, `ffmpeg-skill`, `brag`, `brag-slim` |
| `scripts/` | `doctor`, `check`, `render`, `new-video`, `bootstrap` |
| `assets/` | Общие материалы: музыка, шрифты, логотипы |
| `out/` | Результаты рендера (в git не попадает) |
| `docs/RUNPOD.md` | Как пользователь рендерит и забирает файл |

## 3. Чем делать — выбери движок до первой строки кода

| Запрос | Движок | Что прочитать первым |
| --- | --- | --- |
| Промо, запуск продукта, «сделай ролик про этот репозиторий» | HyperFrames + скилл `brag` | `.agents/skills/brag/SKILL.md` |
| Моушн-графика, объяснялка, титры, графики, карты, кинетическая типографика | HyperFrames | `.agents/skills/hyperframes/SKILL.md` |
| Регулярная генерация из данных, React-композиции, переиспользуемые шаблоны, точный контроль кадров | Remotion | этот файл, раздел 5 |
| Резка, склейка, субтитры, нормализация громкости, вертикальный кроп, выгрузка под платформу | ffmpeg-skill (пост-продакшн) | `.agents/skills/ffmpeg-skill/SKILL.md` |

Правило: **сначала `SKILL.md` выбранного движка, потом код.** Скиллы содержат контракт рендера,
которого нет в обычной веб-документации; без них композиция проходит глазами и падает на рендере.

`ffmpeg-skill` — не движок анимации, а руки: он режет, кропает, чистит звук, жмёт под платформу.
Он же — финальный контроль качества любого результата (`probe.py`, `check.py`, `look.py`).

## 4. HyperFrames: рабочий цикл

```bash
node scripts/new-video.mjs my-slug --engine hyperframes --title "My Film"
cd videos/my-slug
# ... пишешь index.html и compositions/*.html по контракту скилла ...
npx hyperframes check --json          # гейт: чини все error, взвешивай warning
npx hyperframes snapshot --at 1,3,5   # PNG в .hyperframes/artifacts/snapshots/ — посмотри их
node ../../scripts/render.mjs my-slug --quality draft   # 540p, проверка движения
```

`check` и `snapshot` — это твои глаза. Рендер без просмотра кадров не считается сделанным.

Минимум, который ломает рендер чаще всего:

- у каждого таймингового элемента есть `class="clip"`, `data-start` и `data-duration`;
- длина ролика = `data-duration` корневого `#root`, а не сумма сцен;
- на каждую композицию ровно один **paused** таймлайн в `window.__timelines["<id>"]`;
- сцены — только через `data-composition-src="compositions/x.html"`, файл сцены — внутри `<template>`;
- пути к ассетам корневые (`assets/...`), в том числе из под-композиций;
- никаких CSS `transform` на элементах, которые двигает GSAP.

## 5. Remotion: рабочий цикл

```bash
node scripts/new-video.mjs my-slug --engine remotion --title "My Film"
cd videos/my-slug
npx tsc --noEmit                      # типы
npx remotion render src/index.ts Hello ../../out/my-slug-draft.mp4 --scale=0.5
```

Каркас: `src/index.ts` → `registerRoot`, `src/Root.tsx` → `<Composition>`, `src/<Name>.tsx` → кадр.
Длительность, fps и размер живут в `Root.tsx` и обязаны совпадать с `video.json`.
Для статичного кадра-проверки: `npx remotion still src/index.ts Hello ../../out/still.png --frame=45`.

## 6. Манифест `video.json`

```json
{
  "slug": "my-slug",
  "title": "My Film",
  "engine": "hyperframes",
  "duration": 12,
  "width": 1920,
  "height": 1080,
  "fps": 30,
  "audio": true,
  "quality": "looks",
  "notes": "что это за ролик, одной строкой"
}
```

Для Remotion добавь `"entry": "src/index.ts"` и `"composition": "Hello"`.
`quality` — `draft` | `looks` | `delivery`. Под рендерит ровно то, что здесь написано: расхождение
между `video.json` и фактической длительностью/размером — это баг, который ловит `node scripts/check.mjs`.

## 7. Звук

- Музыка и SFX уже лежат в `.agents/skills/brag/assets/` (CC BY, Kenney + ende.app). Копируй нужный
  файл в `videos/<slug>/assets/audio/` — композиция не должна ссылаться на путь вне своей папки.
- Голос: `npx hyperframes tts` (локально, без ключей) или `/media-use`, если нужен аватар/HeyGen.
- Любой `<audio>` обязан иметь `id`, иначе он не попадёт в микс.
- Громкость выравнивай `ffmpeg-skill` (`loudness.py -I -14 --tp -1` для соцсетей), а не на слух.

## 8. Пост-продакшн и выдача

```bash
S=.agents/skills/ffmpeg-skill/scripts
python3 $S/probe.py out/my-slug.mp4 --compact
python3 $S/look.py out/my-slug.mp4 --safe tiktok      # PNG, который надо посмотреть
python3 $S/export.py out/my-slug.mp4 --preset reels --json
```

Платформенные пресеты (`tiktok`, `reels`, `shorts`, `youtube`, `x`, `linkedin`, `facebook`) уже
включают кроп, громкость и проверку. Не изобретай ffmpeg-строку руками — она не проверит результат.

Результат рендера всегда: `out/<slug>.mp4` + `out/<slug>.json` + `out/<slug>.contact.png`.
Контактный лист — единственный способ «увидеть» готовый файл; прикладывай его к ответу.

## 9. Когда что-то падает

| Симптом | Что делать |
| --- | --- |
| `check` ругается на тайминг | сверить `data-duration` корня с концом последнего клипа |
| Чёрный/пустой кадр в snapshot | сцена не смонтировалась: `<template>` + `#root`, путь `data-composition-src` |
| Chrome не стартует | `npx hyperframes browser ensure`, затем `node scripts/doctor.mjs` |
| `remotion render` просит браузер | `npx remotion browser ensure` |
| `ffmpeg: command not found` на поде | `bash scripts/bootstrap.sh` (он ставит статический FFmpeg в `.bin/`) |
| Рендер на поде идёт вечно | 1080p30, > 60 c, сложные шейдеры — уменьшить длительность, а не ждать |
| Нужен кадр из готового mp4 | `ffmpeg -ss 3 -i out/x.mp4 -frames:v 1 out/x-f3.png` и посмотреть |

## 10. Чего не делать

- Не открывать `preview`/`present` в облачной сессии: там нет браузера пользователя, это тупик.
- Не пытаться отдать `.mp4` в чат — файл забирают с пода (`docs/RUNPOD.md`).
- Не менять версии в `package.json` и `package-lock.json` без прямой просьбы: под рендерит тем же
  деревом зависимостей, что и здесь.
- Не трогать `.agents/skills/**` — это вендоренные исходники, они обновляются отдельно.
