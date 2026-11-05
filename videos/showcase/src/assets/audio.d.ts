// Media imported as modules (Remotion bundles these through webpack: <Audio src={musicSrc} />).
declare module "*.mp3" {
  const src: string;
  export default src;
}

declare module "*.wav" {
  const src: string;
  export default src;
}
