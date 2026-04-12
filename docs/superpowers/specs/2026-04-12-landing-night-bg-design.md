# Landing Night Background Image Swap Design Spec

Date: 2026-04-12
Topic: Use landing_night background for landing in night theme

## Summary
In night theme, use `public/backgrounds/landing_night.png` as the landing background image while keeping the day image unchanged. Keep the existing night overlay.

## Goals
- Night-only: landing background switches to `landing_night.png`.
- Day theme unchanged.
- Overlay behavior unchanged.

## Non-Goals
- No other visual or layout changes.

## Implementation Notes
- Update `src/app/globals.css` with a night-scoped background-image override.

## Testing
- Manual check:
  - Night theme shows the new background image.
  - Day theme remains unchanged.
