export function resolveAudioPath(assetId: string): string {
  if (assetId.startsWith("pad_")) return `/audio/foundation/${assetId}.mp3`;
  if (assetId.startsWith("texture_")) return `/audio/texture/${assetId}.mp3`;
  if (assetId.startsWith("nature_")) return `/audio/nature/${assetId}.mp3`;
  if (assetId.startsWith("motion_")) return `/audio/motion/${assetId}.mp3`;
  if (assetId.startsWith("accent_")) return `/audio/accent/${assetId}.mp3`;

  console.warn("[audio] Unknown asset prefix:", assetId);
  return "";
}
