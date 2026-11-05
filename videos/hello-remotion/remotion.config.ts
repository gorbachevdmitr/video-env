import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// Rendering on a pod is CPU-only; keep the default (Chrome + libx264) path.
