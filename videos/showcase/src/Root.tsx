import { AbsoluteFill, Composition, Sequence, interpolate, useCurrentFrame } from "remotion";
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
 *   Starfield          base layer, runs the whole film
 *   CinematicTitleIntro 0.0 – 4.5 s
 *   StatCounter         5.0 – 9.5 s
 *   TextHighlight      10.0 – 13.0 s
 *   LowerThird         13.0 – 15.0 s
 *
 * The demo `cross-dissolve` component is intentionally not used: a real transition is a fade on
 * the layer that enters, which is what <Fade> below does in four lines.
 */

// Fades the layer it wraps in/out, measured in frames local to its <Sequence>.
const Fade = ({
  children,
  inAt = 0,
  outAt,
  fade = 14,
}: {
  children: React.ReactNode;
  inAt?: number;
  outAt?: number;
  fade?: number;
}) => {
  const frame = useCurrentFrame();

  const fadeIn = interpolate(frame, [inAt, inAt + fade], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut =
    outAt === undefined
      ? 1
      : interpolate(frame, [outAt - fade, outAt], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

  return <AbsoluteFill style={{ opacity: Math.min(fadeIn, fadeOut) }}>{children}</AbsoluteFill>;
};

const Film = () => (
  <AbsoluteFill style={{ backgroundColor: BRAND.ground }}>
    <Starfield />

    <Sequence durationInFrames={135}>
      <Fade outAt={135} fade={18}>
        <CinematicTitleIntro />
      </Fade>
    </Sequence>

    <Sequence from={150} durationInFrames={135}>
      <Fade outAt={135} fade={18}>
        <StatCounter />
      </Fade>
    </Sequence>

    <Sequence from={300} durationInFrames={90}>
      <Fade outAt={90} fade={12}>
        <TextHighlight />
      </Fade>
    </Sequence>

    <Sequence from={375} durationInFrames={75}>
      <Fade fade={12}>
        <LowerThird />
      </Fade>
    </Sequence>
  </AbsoluteFill>
);

// durationInFrames / fps / width / height must match video.json — scripts/check.mjs enforces it.
export const RemotionRoot = () => (
  <Composition id="Showcase" component={Film} durationInFrames={450} fps={30} width={1920} height={1080} />
);
