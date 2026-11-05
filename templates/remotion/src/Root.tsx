import { Composition } from "remotion";
import { Hello } from "./Hello";

// durationInFrames / fps / width / height must match video.json — scripts/check.mjs enforces it.
export const RemotionRoot = () => (
  <Composition id="Hello" component={Hello} durationInFrames={150} fps={30} width={1920} height={1080} />
);
