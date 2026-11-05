/**
 * Adapted from reactvideoeditor/remotion-templates — `starfield.tsx` (MIT).
 *
 * Kept: the deterministic radial drift (seeded by index, no Math.random).
 * Changed: brand ground colour, slightly more stars, and a few accent-tinted ones so the
 * background sits in the same palette as the rest of the film.
 */
import { useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND } from "../brand";

const TOTAL_STARS = 110;

export default function Starfield() {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();

  const cx = width / 2;
  const cy = height / 2;

  const stars = Array.from({ length: TOTAL_STARS }, (_, i) => {
    const seedAngle = ((i * 137.508) % 360) * (Math.PI / 180);
    const seedRadius = ((i * 31 + 17) % 50) / 50;
    const speed = 0.5 + ((i * 7 + 3) % 10) / 10;
    const baseSize = 1 + ((i * 13 + 5) % 3);

    const cycleLength = fps * 5;
    const progress = ((frame * speed + i * 15) % cycleLength) / cycleLength;

    const maxRadius = Math.max(cx, cy) * 1.2;
    const radius = seedRadius * 20 + progress * maxRadius;

    const x = cx + Math.cos(seedAngle) * radius;
    const y = cy + Math.sin(seedAngle) * radius;

    const size = baseSize * (1 + progress * 2);
    const opacity = Math.min(progress * 4, 1) * Math.max(1 - progress * 0.8, 0.2);

    return {
      x,
      y,
      size,
      opacity,
      color: i % 9 === 0 ? BRAND.accent : "#ffffff",
      key: i,
    };
  });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: BRAND.ground,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {stars.map((star) => (
        <div
          key={star.key}
          style={{
            position: "absolute",
            left: star.x,
            top: star.y,
            width: star.size,
            height: star.size,
            borderRadius: "50%",
            backgroundColor: star.color,
            opacity: star.opacity,
            transform: "translate(-50%, -50%)",
          }}
        />
      ))}
    </div>
  );
}
