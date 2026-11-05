/**
 * Adapted from reactvideoeditor/remotion-templates — `stat-counter.tsx` (MIT).
 *
 * Kept: the spring entrance and the interpolate count-up.
 * Changed: demo gradient background removed, the card is a translucent pane over the starfield,
 * the number counts to 81 (the real component count) instead of a fake 1247, and every size is
 * doubled for 1080p.
 */
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND, FONT_STACK } from "../brand";

export default function StatCounter() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scaleSpring = spring({ frame, fps, config: { damping: 12, stiffness: 100 } });

  const count = Math.round(
    interpolate(frame, [10, 75], [0, 81], { extrapolateRight: "clamp", extrapolateLeft: "clamp" }),
  );

  const subStatsOpacity = interpolate(frame, [55, 70], [0, 1], {
    extrapolateRight: "clamp",
    extrapolateLeft: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT_STACK,
      }}
    >
      <div
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.04)",
          border: "1px solid rgba(255, 255, 255, 0.10)",
          borderRadius: 28,
          padding: "76px 120px",
          textAlign: "center",
          transform: `scale(${scaleSpring})`,
        }}
      >
        <div
          style={{
            fontSize: 220,
            fontWeight: 800,
            color: BRAND.ink,
            letterSpacing: "-0.05em",
            lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {count}
        </div>

        <div
          style={{
            fontSize: 40,
            color: BRAND.accent,
            marginTop: 18,
            fontWeight: 500,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          готовых компонентов
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 44,
            marginTop: 34,
            opacity: subStatsOpacity,
            fontSize: 30,
            color: BRAND.muted,
          }}
        >
          <span>HyperFrames · Remotion</span>
          <span>MIT · без API-ключей</span>
        </div>
      </div>
    </div>
  );
}
