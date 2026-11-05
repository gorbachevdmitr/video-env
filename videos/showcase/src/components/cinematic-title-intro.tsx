/**
 * Adapted from reactvideoeditor/remotion-templates — `cinematic-title-intro.tsx` (MIT).
 *
 * Kept: the two springs (title rise + fade) and the underline that grows 20→50.
 * Changed: the demo gradient background is gone so the starfield shows through; copy, sizes and
 * colours are the project's. Base geometry in the original is 960×540, so every px here is ×2.
 */
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND, FONT_STACK } from "../brand";

export default function CinematicTitleIntro() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleY = spring({ frame, fps, from: 64, to: 0, durationInFrames: 40, config: { damping: 14, mass: 0.8 } });
  const titleOpacity = spring({ frame, fps, from: 0, to: 1, durationInFrames: 30 });
  const underlineWidth = interpolate(frame, [20, 50], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const subtitleOpacity = interpolate(frame, [40, 62], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT_STACK,
      }}
    >
      <h1
        style={{
          color: BRAND.ink,
          fontSize: 132,
          fontWeight: 700,
          letterSpacing: "-0.04em",
          lineHeight: 1,
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
          margin: 0,
        }}
      >
        video-env
      </h1>

      <div
        style={{
          width: `${underlineWidth}%`,
          maxWidth: 520,
          height: 6,
          background: BRAND.accent,
          borderRadius: 3,
          marginTop: 28,
        }}
      />

      <p
        style={{
          color: BRAND.muted,
          fontSize: 38,
          fontWeight: 400,
          letterSpacing: "0.06em",
          opacity: subtitleOpacity,
          marginTop: 30,
        }}
      >
        пять репозиториев · одна среда
      </p>
    </div>
  );
}
