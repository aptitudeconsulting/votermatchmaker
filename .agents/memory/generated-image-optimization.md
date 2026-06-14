---
name: Generated image optimization for web
description: generateImage outputs large PNGs; compress before shipping to a web artifact
---

# Generated image optimization

`generateImage` / `generateImageAsync` only emit PNG, and the files are large (~1.3–2 MB each at default size). Shipping them straight into a web hero/page tanks LCP on mobile.

**Rule:** before importing AI-generated images into a web artifact, downscale + convert to WebP. ImageMagick (`magick`) is available in this env (no `sharp`).

**How to apply:** e.g.
`magick in.png -resize 1600x -quality 78 out.webp` (hero ~1600px, secondary ~1000–1200px, q 78–80). Then import the `.webp` and delete the `.png`. Vite's `@/assets` alias imports `.webp` fine.

**Why:** a ~1.4 MB PNG hero dropped to ~50 KB as WebP — same visual quality, ~25× smaller. Architect review flagged the unoptimized PNGs as the biggest practical perf risk.
