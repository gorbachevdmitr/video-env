import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

const GROUND = "#0b0c10";
const INK = "#f5f6f8";
const MUTED = "#9aa3b2";
const ACCENT = "#ffd166";

export const Hello = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 28 });
  const titleY = interpolate(enter, [0, 1], [56, 0]);
  const titleOpacity = interpolate(enter, [0, 1], [0, 1]);
  const rule = interpolate(frame, [16, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const subOpacity = interpolate(frame, [30, 48], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [130, 150], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: GROUND,
        fontFamily: "sans-serif",
        padding: "0 160px",
        justifyContent: "center",
        opacity: fadeOut,
      }}
    >
      <div
        style={{
          color: INK,
          fontSize: 148,
          fontWeight: 700,
          letterSpacing: "-0.045em",
          lineHeight: 0.98,
          transform: `translateY(${titleY}px)`,
          opacity: titleOpacity,
        }}
      >
        {{TITLE}}
      </div>

      <div
        style={{
          height: 2,
          width: 220,
          backgroundColor: ACCENT,
          margin: "40px 0 32px",
          transform: `scaleX(${rule})`,
          transformOrigin: "left center",
        }}
      />

      <div style={{ color: MUTED, fontSize: 34, letterSpacing: "0.04em", opacity: subOpacity }}>
        Authored in the cloud. Rendered on a pod.
      </div>
    </AbsoluteFill>
  );
};
