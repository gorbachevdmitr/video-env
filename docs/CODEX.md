# Подключить GPT (Codex Cloud) к этому репозиторию

Итог: GPT работает **в** репозитории — читает `AGENTS.md`, пишет композиции, гоняет `check` и смотрит
кадры. Финальный рендер остаётся за подом: в облаке 2–4 vCPU и 8–32 ГБ диска, этого хватает на
авторинг и черновик, но не на боевой 1080p за минуту.

## Что нужно до начала

- План ChatGPT с доступом к Codex: Plus, Pro, Business, Edu или Enterprise.
- Репозиторий на GitHub: `github.com/gorbachevdmitr/video-env` (ветка `main`).
- Доступ к GitHub из Codex — он попросит установить GitHub App и выдать права на репозиторий.

## Шаг 1. Запушить репозиторий

```bash
cd video-env
git remote add origin https://github.com/gorbachevdmitr/video-env.git
git push -u origin main
```

Проверка: на GitHub видно `AGENTS.md`, `.agents/skills/`, `scripts/bootstrap.sh`, `videos/showcase/`.

## Шаг 2. Создать окружение

В вебе или в приложении ChatGPT:

1. Новая задача → **Work in** → **Cloud**.
2. **Select environment** → **Create environment**.
3. Выбрать репозиторий `video-env`. Если GitHub не подключён — **Connect GitHub** и выдать доступ
   именно этому репозиторию.
4. **Get started** — Codex сам осмотрит репозиторий и предложит установку.

Альтернативный вход: **Settings → Codex Cloud → Environments → Create environment**.

## Шаг 3. Install script

Codex запишет проверенную установку в поле **Install script**. Нужна ровно одна команда:

```bash
bash scripts/bootstrap.sh
```

Что она делает: Node 22 (если системный старше), статический FFmpeg 6.1+, библиотеки для headless
Chrome, `npm ci`, оба браузера, затем `doctor`. Скрипт идемпотентен.

Если Codex начнёт изобретать `npm install` и `apt-get` по одному пакету — скажите прямо:

> Используй `bash scripts/bootstrap.sh` как install script. Не добавляй другие шаги установки.

Поле **Start skill** (запуск сервисов) нам не нужно — сервисов нет. Если оно обязательно, впишите
`node scripts/doctor.mjs`.

## Шаг 4. Сеть

По умолчанию агент работает без интернета, а установка — с ним. Наш `bootstrap.sh` качает пакеты,
Node, FFmpeg и Chrome, поэтому:

- **Просто:** включить **Enable all public internet access** на время setup, после публикации —
  выключить, если хотите строгий режим.
- **Аккуратно:** оставить ограниченный доступ, включить пресет **Package managers** и добавить
  домены, которых в нём нет:

```
nodejs.org
storage.googleapis.com
```

`github.com` и `release-assets.githubusercontent.com` уже входят в пресет (оттуда статический FFmpeg).
`storage.googleapis.com` нужен Puppeteer и Remotion для скачивания Chrome.

Агенту после установки интернет не нужен: скиллы вендорены, музыка и GSAP лежат в репозитории,
композиции не ходят в CDN.

## Шаг 5. Опубликовать

Просмотрите отчёт установки → **Publish**. Появится **Environment published**. Только после этого
окружение доступно новым задачам.

Правки потом: **Settings → Codex Cloud → Environments → … → Edit** → изменения → **Republish**.
Существующие задачи остаются на своей копии состояния.

## Шаг 6. Первая задача

В новой задаче выберите окружение и напишите:

```
Прочитай AGENTS.md и videos/showcase. Собери 10-секундный ролик про этот репозиторий:
1080p30, тёмный фон, жёлтый акцент, три короткие фразы титрами.
Сначала прогони node scripts/doctor.mjs и покажи результат.
```

Что должно произойти:

1. `node scripts/doctor.mjs` — 11 ok, 0 failures.
2. Агент создаёт `videos/<slug>/`, читает `.agents/skills/hyperframes/SKILL.md` (или
   `remotion-templates`), пишет композицию.
3. `node scripts/check.mjs` — 0 ошибок; `snapshot` — PNG-кадры, которые он смотрит.
4. Коммит в ветку и PR — **это и есть выдача**. `.mp4` в чат не приходит.

## Чек-лист приёмки первой задачи

| Проверить | Как |
| --- | --- |
| Окружение живое | в логе `doctor` все строки `✓` |
| Скиллы видны | агент цитирует `.agents/skills/...`, а не пересказывает по памяти |
| Манифест на месте | в PR есть `videos/<slug>/video.json` с `duration` и `engine` |
| Гейт пройден | `check.mjs` зелёный, кадры приложены |
| Нет мусора | в диффе нет `node_modules/`, `out/`, `.bin/`, `.mp4` |

## Что важно знать про облако

- **Размер VM.** Plus — 2 vCPU / 8 ГБ RAM / 8 ГБ диска: `npm ci` + Chrome + репозиторий помещаются,
  но запаса мало. Pro/Business — 4 vCPU / 16 ГБ / 32 ГБ, комфортнее.
- **Скиллы из репозитория подхватываются** (документация Codex: skills in the repository are
  available in cloud tasks; личные скиллы с ноутбука — нет). Поэтому `.agents/skills/` в git — это
  не украшение.
- **Браузером агент не пользуется** (в cloud это пока не поддерживается), поэтому `preview` в
  облаке — тупик; единственные «глаза» — `snapshot` и контактные листы PNG.
- **Рендер финала — на поде.** 1080p в облаке на 2 vCPU — это часы. См. [RUNPOD.md](RUNPOD.md).
- **Состояние задачи живёт 7 дней** после последнего хода. Всё важное — в git, не в файловой системе.

## Если установка падает

| Симптом | Причина | Что делать |
| --- | --- | --- |
| `npm ci` падает на сети | запрещён `registry.npmjs.org` | добавить пресет Package managers |
| Chrome не скачивается | закрыт `storage.googleapis.com` | добавить домен в Additional allowed domains |
| `ffmpeg` старый или отсутствует | apt-версия 4.4 | `bootstrap.sh` ставит статический 6.1+ в `.bin/`, перезапустите его |
| Установка идёт вечно | сильный `npm ci` на 2 vCPU | это нормально для первого раза; публикуйте, дальше кэш |
| `doctor` падает на skills | репозиторий склонирован неполно | проверить, что `.agents/skills/` есть в ветке |

## Локальная альтернатива

Если нужен не облачный, а локальный Codex CLI в этом же репозитории — всё работает так же:
`bash scripts/bootstrap.sh` (Linux/macOS) или `scripts/setup.ps1` (Windows), затем `codex` в корне.
Отличие одно: локально можно рендерить финал самому, без пода.
