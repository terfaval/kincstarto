/** A carousel displays only entire book slots; never round the capacity up. */
export function wholeBookCapacity(extent: number, slot: number, gap: number, padding = 0): number {
  if (!Number.isFinite(extent) || !Number.isFinite(slot) || slot <= 0 || !Number.isFinite(gap) || gap < 0) return 1;
  const available = Math.max(0, extent - Math.max(0, padding));
  // 1px safety margin keeps fractional device-pixel rounding from clipping a book.
  return Math.max(1, Math.floor((available + gap - 1) / (slot + gap)));
}
