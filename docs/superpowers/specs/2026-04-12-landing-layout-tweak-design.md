# Landing Page Layout Tweak Design Spec

Date: 2026-04-12
Topic: Narrower cards and full-visibility background

## Summary
Adjust the landing page card layout to be visibly narrower and update the landing background so the full image can be seen without empty side bars, using a blurred fill layer to cover extra space.

## Goals
- Make the three landing cards visually narrower and centered.
- Ensure the full `landing_background.png` is visible.
- Avoid empty side bars while keeping the full image visible.

## Non-Goals
- No content changes.
- No routing changes.
- No new assets.

## Layout Changes
- Reduce the landing cards container width and add a per-card max width.
- Keep grid centered with consistent spacing.

## Background Strategy
- Use a two-layer background on the landing shell:
  - Top layer: `contain` so the full image is visible.
  - Bottom layer: same image `cover` + blur to fill any leftover space.
- This preserves full image visibility while avoiding empty bands.

## Styling Notes
- Use CSS-only changes in `src/app/globals.css`.
- Avoid global side effects outside the landing styles.

## Testing
- Manual check:
  - Cards appear visibly narrower than before.
  - Background shows the full image without empty side bars.
  - Layout remains responsive.
