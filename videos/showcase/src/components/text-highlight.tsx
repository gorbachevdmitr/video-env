/**
 * Adapted from reactvideoeditor/remotion-templates — `text-highlight.tsx` (MIT).
 *
 * Kept: the word-by-word highlight bar and the interpolate timing.
 * Changed: background removed, the sentence is the project's, and the glyph switches to the
 * ground colour once the accent bar has covered more than half of it (otherwise white on
 * #ffd166 fails contrast).
 */
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND, FONT_STACK } from "../brand";

const WORDS = ["Один", "репозиторий.", "Три", "движка.", "Ноль", "ручной", "работы."];

export default function TextHighlight() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 7 words × 10 frames = 70 of the 90 frames in this sequence, leaving a short hold before the fade.
  const framesPerWord = Math.floor(fps * 0.36);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
        fontFamily: FONT_STACK,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          gap: 18,
          maxWidth: 1620,
          padding: 40,
          rowGap: 14,
        }}
      >
        {WORDS.map((word, i) => {
          const wordStart = i * framesPerWord;
          const highlightProgress = interpolate(
            frame,
            [wordStart, wordStart + framesPerWord * 0.6],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );

          const inverted = highlightProgress > 0.55;

          return (
            <span
              key={word + i}
              style={{
                position: "relative",
                display: "inline-block",
                fontSize: 84,
                fontWeight: 700,
                letterSpacing: "-0.03em",
                color: inverted ? BRAND.ground : BRAND.ink,
                padding: "6px 18px",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: `${highlightProgress * 100}%`,
                  background: BRAND.accent,
                  borderRadius: 10,
                  zIndex: 0,
                  opacity: highlightProgress > 0 ? 0.95 : 0,
                }}
              />
              <span style={{ position: "relative", zIndex: 1 }}>{word}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
