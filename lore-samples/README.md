# Lore samples — for verifying the 5D.4 palette recolor (checkpoint ④)

Two ready-to-drop lore files whose vocabulary is written to force a **specific,
predictable** world recolor. Both are deliberately *tone-neutral* (no dark/cozy/
heroic words), so the dominant **theme** drives the palette with no ambiguity.

| File | Dominant theme | → World palette | Looks like |
|---|---|---|---|
| `pastoral.md` | pastoral | **gruvbox-dark** | teal `#002b36` → warm brown-gray `#282828`, text goes cream/gold |
| `nautical.md` | nautical | **tokyo-night** | teal `#002b36` → deep indigo-navy `#1a1b26`, text goes blue-lavender |

Boot default (no lore) is **Solarized dark** (cool teal).

## Confirm the prediction headlessly (no app needed)

```
npx tsx scripts/lore-preview.mts lore-samples/pastoral.md lore-samples/nautical.md
```

Runs the real `buildLoreProfile` + `themeFromLore` the same way the desktop
ingest path does. Already verified: `pastoral → gruvbox-dark`,
`nautical → tokyo-night`. So the whole lore→theme derivation is confirmed; the
only thing left to eyeball is the on-screen repaint.

## See it on screen (macOS — recolor is DESKTOP-ONLY)

The recolor needs the real SQLite writer, so it only works in the Electron app
(the web build has a null writer → always default theme).

1. Put your key in `worker/.dev.vars` → `ANTHROPIC_API_KEY=sk-ant-...`
   (`LLM_PROVIDER` is already `anthropic`).
2. Three terminals, Node 22 (the repo `.nvmrc`):
   - `npm run worker`
   - `npm run dev`
   - `cd desktop && npm run dev`
3. App opens at the `cell` level in **Solarized dark** (teal). Keep it in
   **window mode** (wallpaper mode gates keyboard input).
4. Press **Ctrl+U** → the lore drop-zone. Drag in `pastoral.md`.
5. When the status shows a chunk count, the world tears down and **remounts in
   gruvbox-dark** (warm brown/cream). One brief black flash during remount is
   normal; there must be exactly **one** canvas after.
6. Repeat with `nautical.md` → it remounts in **tokyo-night** (indigo).

The two egress checkboxes ("Theme & mood", "Quote directly") default OFF — the
recolor happens with both off (it's local, never gated on egress).

## See agents *reference* the lore (the deeper half of ④)

This is the part that uses the Claude API:

1. In the drop-zone, tick **both** egress checkboxes after ingesting a file.
2. Walk `@` next to a known-game bookshelf and press **E** — `game_launched`
   force-fires a Tier-2 reflection (no waiting for the importance threshold).
3. Watch the `npm run worker` terminal for `[router] tier2 … dispatched` and a
   reflection that names the lore (harvest/village, or harbour/tide). Reflection
   runs on Claude Sonnet now, so quality should read well.

Note: with no Ollama there are no embeddings, so lore *retrieval* uses the
recency/FTS path — still feeds the reflection, just not cosine-ranked.
