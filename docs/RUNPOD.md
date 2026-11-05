# Рендер на RunPod

Репозиторий рассчитан на то, что его клонируют на чистый под и одной командой поднимают.
Ни Docker-образа, ни GPU-магии не нужно: рендер — это headless Chrome + ffmpeg, то есть **CPU**.

## 1. Какой под брать

| Параметр | Значение | Почему |
| --- | --- | --- |
| Тип | **CPU Pod** (Secure Cloud) | GPU не используется: CUDA в рендере не участвует |
| vCPU | 8 (минимум 4) | Chrome рендерит кадры параллельно, 4 vCPU — это ~2× медленнее |
| RAM | 16 ГБ (минимум 8) | 1080p-кадры + Chrome |
| Container disk | 20 ГБ | node_modules + браузеры ≈ 1.5 ГБ |
| Network volume | 50 ГБ, монтируется в `/workspace` | репозиторий, `node_modules` и Chrome переживают перезапуск пода |

GPU-под имеет смысл только если вы параллельно генерируете картинки/видео моделями. Для этого
репозитория он просто дороже.

## 2. Поднять окружение (один раз на под)

В RunPod → **Connect** → **Web Terminal** (или SSH):

```bash
cd /workspace
git clone https://github.com/gorbachevdmitr/video-env.git
cd video-env
bash scripts/bootstrap.sh
```

Что делает `bootstrap.sh`:

1. ставит Node 22 в `.bin/node`, если системный старше;
2. ставит статический FFmpeg 6.1+ в `.bin/` (системный в образах часто 4.4 — `ffmpeg-skill` его отвергает);
3. доставляет разделяемые библиотеки для headless Chrome (`libnss3`, `libgbm1`, `libasound2`, шрифты);
4. `npm ci` — ровно те версии, что в `package-lock.json`;
5. `hyperframes browser ensure` и `remotion browser ensure`;
6. пишет `.bin/env.sh` и прогоняет `doctor`.

Время: 4–6 минут на холодном поде, секунды на прогретом (всё лежит в `/workspace`).
Проверка: `node scripts/doctor.mjs` — все строки должны быть `✓`.

## 3. Отрендерить

```bash
node scripts/render.mjs --list                 # что вообще есть
node scripts/render.mjs --all                  # всё, качество из video.json
node scripts/render.mjs my-slug --quality delivery
node scripts/render.mjs --all --quality draft  # быстрая проверка, 540p
```

Рендер идёт **последовательно**, по одному ролику: параллельный запуск двух Chrome-инстансов
на 8 vCPU только замедляет каждый. Результат на каждый ролик:

```
out/<slug>.mp4           видео
out/<slug>.json          ffprobe: длительность, размер, кодеки, дрейф длительности
out/<slug>.contact.png   8 кадров сеткой — по нему видно, что реально получилось
```

Если `durationDrift` в json больше ±0.4 с — расходится `video.json` и композиция, это баг, а не мелочь.

Ожидаемое время на 8 vCPU: 1080p30 — примерно 2–4× реального времени ролика
(30-секундный ролик ≈ 1–2 минуты). Черновик 540p — в 3–4 раза быстрее.

## 4. Забрать файл домой

**runpodctl** — самый простой путь, ставится на под из коробки:

```bash
# на поде
runpodctl send out/my-slug.mp4
# -> Code is: 8338-galileo-collect-fidel

# дома (runpodctl install: https://docs.runpod.io/runpodctl/overview)
runpodctl receive 8338-galileo-collect-fidel
```

**SCP** — если файл большой или их много (порт и IP — в Connect → SSH):

```bash
scp -P <port> -i ~/.ssh/id_ed25519 root@<ip>:/workspace/video-env/out/my-slug.mp4 .
```

**Cloud Sync** — если рендерите пачками: подключите S3/GCS в настройках пода и складывайте `out/` туда.

Забирать файл через git не надо: `.mp4` в `.gitignore`, а GitHub не любит большие бинари.

## 5. Повторный рендер и кэш

- Держите репозиторий на network volume (`/workspace`) — тогда `node_modules` и Chrome не
  скачиваются заново.
- `.bin/`, `node_modules/`, `out/`, `.hyperframes/` — всё локальное, в git не попадает.
- Обновили композицию в облаке: `git pull && node scripts/render.mjs my-slug`. `bootstrap.sh`
  повторно запускать не нужно, если не менялся `package-lock.json`.
- Меняли `package-lock.json` — `bash scripts/bootstrap.sh` (он идемпотентен) или просто `npm ci`.

## 6. Гигиена денег

- Под тарифицируется по часам, пока жив. Отрендерили — **Stop** (не Terminate, если нужен
  network volume).
- Холодный bootstrap 5 минут на CPU-поде стоит меньше цента, но забытый на ночь под — уже нет.
- Пятиминутный ролик на 8 vCPU — это десятки минут рендера. Если хочется длинное видео,
  лучше собрать его из 3–4 коротких сцен и склеить `ffmpeg-skill` (`join.py`), чем ждать один
  гигантский рендер.

## 7. Проверенный рецепт (реально сработало)

CPU-под 2 vCPU / 4 ГБ, образ `runpod/base:0.7.0-ubuntu2004`, из коробки уже есть git, curl, xz,
python3 и ffmpeg 4.2 (его заменяет `bootstrap`).

```bash
# 1. ключ для SSH (один раз): добавить свой публичный ключ в аккаунт
runpodctl ssh add-key --key-file ~/.ssh/id_ed25519.pub

# 2. под
runpodctl pod create --compute-type cpu --image runpod/base:0.7.0-ubuntu2004 \
  --name video-env-render --container-disk-in-gb 30 --ports "22/tcp" --wait --wait-timeout 12m

# 3. адрес
runpodctl ssh info <pod-id>

# 4. на поде: код + окружение
git clone --branch <ветка> --depth 1 https://github.com/gorbachevdmitr/video-env.git /root/video-env
cd /root/video-env && bash scripts/bootstrap.sh && source .bin/env.sh

# 5. рендер — в живой SSH-сессии
node scripts/render.mjs repo-intro --quality delivery
```

Замеры на таком поде: `bootstrap` с нуля — ~6 минут (Node, FFmpeg, Chrome, `npm ci`), повторный
запуск — секунды; рендер 10 с в 1080p `delivery` — **21 секунда**. Контактный лист 8 кадров
и `ffprobe` пишутся рядом с mp4.

**Не запускайте рендер через `nohup … &`.** HyperFrames отменяет работу, когда родительский
процесс отцепился: в логе будет `render_cancelled_parent_exited` на 25 %. Рендер держите
в открытой SSH-сессии (или в `tmux`), а для долгих задач — `tmux new -s render`.

Ключ, добавленный в аккаунт, после работы можно убрать:
`runpodctl ssh list-keys`, затем `runpodctl ssh remove-key --fingerprint <SHA256:…>`.

## 8. Если что-то не так

| Симптом | Причина | Решение |
| --- | --- | --- |
| `ffmpeg: command not found` | не активирован `.bin` | `source .bin/env.sh` или новый shell |
| `doctor`: ffmpeg too old | системный FFmpeg 4.4 из образа | перезапустить `bootstrap.sh`, он поставит 6.1+ в `.bin` |
| Chrome падает с `libgbm`/`libnss3` | в образе нет библиотек | `bootstrap.sh`, затем `npx hyperframes browser ensure` |
| Рендер висит на первом кадре | не хватило `--timeout` на тяжёлой странице | `npx hyperframes render --timeout 120000` |
| `out/` пустой, а ошибок нет | рендерили черновик из `videos/<slug>`, а не из корня | запускать из корня репозитория |
| Файл больше 100 МБ и не влезает в send | длинный ролик, высокий битрейт | `--quality delivery` не нужен для соцсетей; хватает `looks` |
