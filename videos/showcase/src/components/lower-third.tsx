/**
 * Adapted from reactvideoeditor/remotion-templates — `lower-third.tsx` (MIT).
 *
 * Kept: the three springs (accent rule, bar slide-in, text fade) and the sliding geometry.
 * Changed: demo background removed so it overlays the starfield, the name/role are the project's,
 * and sizes are scaled for 1080p.
 */
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND, FONT_STACK } from "../brand";

export default function LowerThird() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const accentSlide = spring({
    frame,
    fps,
    from: -360,
    to: 0,
    durationInFrames: 25,
    config: { damping: 15, mass: 0.6 },
  });

  const barSlide = spring({
    frame: Math.max(0, frame - 5),
    fps,
    from: -460,
    to: 0,
    durationInFrames: 30,
    config: { damping: 14, mass: 0.7 },
  });

  const textOpacity = spring({
    frame: Math.max(0, frame - 14),
    fps,
    from: 0,
    to: 1,
    durationInFrames: 20,
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        fontFamily: FONT_STACK,
      }}
    >
      <div style={{ position: "absolute", bottom: "14%", left: 120 }}>
        <div
          style={{
            width: 360,
            height: 5,
            background: BRAND.accent,
            transform: `translateX(${accentSlide}px)`,
            borderRadius: 2,
            marginBottom: 10,
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            transform: `translateX(${barSlide}px)`,
          }}
        >
          <div style={{ width: 6, background: BRAND.accent, borderRadius: "3px 0 0 3px" }} />
          <div
            style={{
              background: "rgba(11, 12, 16, 0.78)",
              padding: "26px 46px",
              borderRadius: "0 6px 6px 0",
            }}
          >
            <div
              style={{
                color: BRAND.ink,
                fontSize: 68,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                opacity: textOpacity,
              }}
            >
              video-env
            </div>
            <div
              style={{
                color: BRAND.muted,
                fontSize: 30,
                fontWeight: 400,
                opacity: textOpacity,
                marginTop: 8,
                letterSpacing: "0.05em",
              }}
            >
              authored in the cloud · rendered on a pod
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
