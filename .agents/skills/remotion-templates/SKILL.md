# Remotion Templates (RVE) — 81 готовый компонент

Коллекция из 81 самостоятельного React-компонента на Remotion-хуках. Каждый — один визуальный
приём: график, титр, переход, фон, логотип, интро. Лицензия MIT, источник и авторы — в
`NOTICE.md` и `UPSTREAM-README.md`.

Компоненты — **заготовки, а не готовая библиотека**: у них нет пропсов, контент и цвета
захардкожены под демо. Их копируют и переписывают под проект.

## Как взять компонент

```bash
node scripts/add-component.mjs my-slug stat-counter         # скопировать в видео
node scripts/add-component.mjs --list                        # все 81 по категориям
node scripts/add-component.mjs --list charts                 # фильтр по категории/слову
```

Скрипт кладёт файл в `videos/<slug>/src/components/` и печатает строку импорта.
Копируй только нужные файлы: тащить все 81 в каждый ролик незачем.

## Как подключить

```tsx
// videos/my-slug/src/Root.tsx
import { Composition, Sequence } from "remotion";
import { Hello } from "./Hello";
import StatCounter from "./components/stat-counter";

const Scene = () => (
  <>
    <Hello />
    <Sequence from={30} durationInFrames={90}>
      <StatCounter />
    </Sequence>
  </>
);

export const RemotionRoot = () => (
  <Composition id="Hello" component={Scene} durationInFrames={150} fps={30} width={1920} height={1080} />
);
```

Компоненты позиционируют себя абсолютно и растягиваются на кадр, поэтому работают слоями:
фон из `Background`, поверх — контент, поверх — `subscribe-reminder`.

## Правила

1. **Переписать контент.** Текст, цифры и палитра в файле — демо. Заменить на своё, сохранив
   математику кадров (`interpolate`, `spring`, тайминги).
2. **Геометрия: база — 960×540.** Все размеры в px подобраны под демо 960×540. На 1080p тот же
   код выглядит вдвое мельче (счётчик 96 px читается как подпись). Перед использованием либо
   удвой кегли, отступы и радиусы, либо держи композицию 960×540 и апскейль кадр. Для 1080×1350 и
   1080×1920 пересчитывай от 1080 по короткой стороне, а не масштабируй контейнер.
3. **Детерминизм.** `random()` берут из `remotion` — он засеян по кадру. Не заменять на
   `Math.random()` и не добавлять `Date.now()`.
4. **Только кадры.** Никаких CSS `transition`/`animation`, `setTimeout`, `repeat: -1` — всё через
   `useCurrentFrame`.
5. **Композиция, а не файл.** Один компонент = один слой. Собирать через `<Sequence>` и
   `<AbsoluteFill>`, а не копировать внутренности одного компонента в другой.
6. **Два файла требуют правки.** `parallax-pan.tsx` и `zoom-pulse.tsx` импортируют
   `next/image` — в этом проекте Next нет. Заменить на обычный `<img>` с теми же стилями.
7. **Длительность.** Большинство анимаций рассчитаны на 60–90 кадров при 30 fps. Если твоя сцена
   короче, обрезать хвост анимации; если длиннее — добавить удержание, а не растягивать `spring`.
8. **Проверка.** После подключения — `npx tsc --noEmit`, затем `npx remotion still ... --frame=N`
   и посмотреть PNG. Компоненты легко дают пустой кадр на первом фрейме.

## Что где искать

| Задача | Категория | Полезные файлы |
| --- | --- | --- |
| Цифры, метрики, сравнения | Charts & Data | `stat-counter`, `comparison-chart`, `bar-chart` (`chart-animation`), `line-chart`, `donut-chart`, `circular-progress` |
| Заголовки и титры | Text | `animated-text`, `typewriter-subtitle`, `slide-text`, `glitch-text`, `text-highlight` |
| Нижняя плашка с именем | Intro & Outro | `lower-third`, `chapter-title`, `end-card` |
| Переход между сценами | Transition | `cross-dissolve`, `slide-wipe`, `whip-pan` (в Cinematic), `zoom-through`, `clock-wipe` |
| Фон под контент | Background | `gradient-shift`, `grid-pulse`, `bokeh-circles`, `starfield`, `noise-grain`, `matrix-rain` |
| Логотип и брендинг | Logo & Branding | `logo-fade-reveal`, `logo-stroke-draw`, `logo-glitch-reveal`, `logo-typewriter` |
| Фото и галереи | Image & Media | `ken-burns`, `polaroid-frame`, `gallery-grid`, `split-screen`, `picture-in-picture` |
| Удар, акцент | Cinematic | `camera-shake`, `zoom-pulse`, `film-burn`, `spotlight-reveal` |
| Список, шаги, уведомления | Content Animation | `animated-list`, `progress-steps`, `notification-pop`, `countdown-timer` |

Полный машинный каталог — `catalog.json` (`name`, `file`, `slug`, `category`, `description`,
`requiresAdaptation`).

## Обновление

Источник: https://github.com/reactvideoeditor/remotion-templates (MIT). SHA зафиксирован в
`docs/VENDOR.md`. Скопировать `templates/*.tsx` в `components/`, затем перегенерировать
`catalog.json` из `UPSTREAM-README.md`.
