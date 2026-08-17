# Failure library
One entry per bad output; one binary check per recurring mode.
Padding this file helps nobody - only real failures Harry flagged.

## Checks

- **verified-in-wrong-viewer** — before handing any HTML artifact to Harry
  for an eyeball: was it opened once in the viewer HE will use (Safari via
  `open`, not headless Chrome), and does a capture of THAT window show the
  intended glyphs? Yes/no. (Mechanical sub-check a script can do: does the
  file's first 1KB contain `<meta charset="utf-8">`?)

## Cases

### 2026-08-17 — mockup glyphs rendered as mojibake in Safari
- **Where**: `docs/design-reviews/2026-08-17-underground-continuation.html`
  as of commit `0b54295` (fixed in `7ab7b54`); the broken rendering is
  preserved in the session scratchpad capture (`safari-view.png`): every
  multibyte glyph decoded as Latin-1 — `—` → `â€"`, box-drawing/shade glyphs
  → `â–`-sequences, tab title `Underground continuation Â· stacked-pair probe`.
- **What was wrong**: the generated HTML declared no charset. I verified the
  page only in headless Chrome (which assumes UTF-8 on `file://`) and handed
  it to Harry, whose Safari (which does not) rendered the entire glyph world
  as mojibake. Harry's first look caught what three of my screenshot passes
  could not — my verification ran in a different viewer than the delivery.
- **Failure mode**: `verified-in-wrong-viewer` (1 case)
