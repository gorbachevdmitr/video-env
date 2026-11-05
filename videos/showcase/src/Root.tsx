import { AbsoluteFill, Audio, Composition, Sequence, interpolate, useCurrentFrame } from "remotion";
import musicSrc from "./assets/business-moves.mp3";
import { BRAND } from "./brand";
import CinematicTitleIntro from "./components/cinematic-title-intro";
import LowerThird from "./components/lower-third";
import Starfield from "./components/starfield";
import StatCounter from "./components/stat-counter";
import TextHighlight from "./components/text-highlight";

/**
 * Reference composition for this environment.
 *
 * Five vendored components, adapted (see the header of each file) and layered:
 *   Starfield            base layer, runs the whole film
 *   CinematicTitleIntro  0.00 – 4.23 s
 *   StatCounter          4.37 – 9.13 s
 *   TextHighlight        9.27 – 12.40 s
 *   LowerThird          12.53 – 15.00 s
 *
 * Three rules this file is meant to demonstrate:
 *
 * 1. Two text scenes never cross-fade. Overlapping "81" and a sentence at 50% opacity each is
 *    unreadable mush; the film dips to the starfield for 6 frames instead (one beat of air).
 * 2. Cuts sit on the music: the track is 109.96 BPM and starts on its first downbeat, so beats are
 *    every 0.545 s of video (frames 131, 278, 376). Scene entrances are placed on those beats.
 *    Credits and the cut-to-beat table are in MUSIC-CREDITS.md.
 * 3. Every scene owns its fade-in and fade-out; butt-joining them without either leaves a frame of
 *    empty starfield and shows the incoming scene at 20% opacity.
 */

const FPS = 30;
const TOTAL_FRAMES = 450;

// The track's first strong beat is at 0.267 s; starting there puts a downbeat on frame 0.
const MUSIC_START_FROM = Math.round(0.267 * FPS);

// Independent values, not a spread: <Sequence> takes `from` and `durationInFrames`, and passing
// `duration` by mistake silently extends every scene to the end of the film.
const SCENES = {
  title: { from: 0, durationInFrames: 127, fadeIn: 0, fadeOut: 12 },
  stat: { from: 131, durationInFrames: 143, fadeIn: 10, fadeOut: 10 },
  highlight: { from: 278, durationInFrames: 94, fadeIn: 10, fadeOut: 10 },
  lowerThird: { from: 376, durationInFrames: 74, fadeIn: 10, fadeOut: 0 },
};

const Scene = ({
  from,
  durationInFrames,
  fadeIn,
  fadeOut,
  children,
}: {
  from: number;
  durationInFrames: number;
  fadeIn: number;
  fadeOut: number;
  children: React.ReactNode;
}) => (
  <Sequence from={from} durationInFrames={durationInFrames}>
    <SceneFade durationInFrames={durationInFrames} fadeIn={fadeIn} fadeOut={fadeOut}>
      {children}
    </SceneFade>
  </Sequence>
);

const SceneFade = ({
  durationInFrames,
  fadeIn,
  fadeOut,
  children,
}: {
  durationInFrames: number;
  fadeIn: number;
  fadeOut: number;
  children: React.ReactNode;
}) => {
  const frame = useCurrentFrame();

  const inOpacity =
    fadeIn === 0
      ? 1
      : interpolate(frame, [0, fadeIn], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
  const outOpacity =
    fadeOut === 0
      ? 1
      : interpolate(frame, [durationInFrames - fadeOut, durationInFrames], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

  return <AbsoluteFill style={{ opacity: Math.min(inOpacity, outOpacity) }}>{children}</AbsoluteFill>;
};

const Film = () => (
  <AbsoluteFill style={{ backgroundColor: BRAND.ground }}>
    <Starfield />

    <Scene {...SCENES.title}>
      <CinematicTitleIntro />
    </Scene>

    <Scene {...SCENES.stat}>
      <StatCounter />
    </Scene>

    <Scene {...SCENES.highlight}>
      <TextHighlight />
    </Scene>

    <Scene {...SCENES.lowerThird}>
      <LowerThird />
    </Scene>

    {/* Music sits outside the Sequences so the volume callback sees global frames. */}
    <Audio
      src={musicSrc}
      startFrom={MUSIC_START_FROM}
      volume={(f) =>
        interpolate(f, [TOTAL_FRAMES - 30, TOTAL_FRAMES], [0.3, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      }
    />
  </AbsoluteFill>
);

// durationInFrames / fps / width / height must match video.json — scripts/check.mjs enforces it.
export const RemotionRoot = () => (
  <Composition id="Showcase" component={Film} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1920} height={1080} />
);
