import type { PaletteKey, ThemeRole } from '../themes/types';

/** Agent-mind pass — per-agent trace vocabulary. The mark's glyph + tint
 *  identify WHO left it before you read a word: Loki dog-ears, the
 *  Archivist files, the cat topples, the ghost chills, the visitor drops.
 *  Every glyph is enumerated in smoke-glyph-coverage RENDERER_LITERALS.
 *  Ladder identity pass (2026-07-17): tints resolve through the role
 *  layer so a mark wears its AUTHOR's accent; the ghost's marks take the
 *  dedicated 'mark.ghost' role (default fg — the dim-but-distinct step;
 *  being.ghost's fgDim would vanish into the floor).
 *  Shared module (marginalia-on-land slice): one vocabulary of trace
 *  glyphs across the cell and the terminal land is the point. */
export interface MarkStyle {
  glyph: string;
  role: ThemeRole;
  fallback: PaletteKey;
}

export const MARK_STYLES: Record<string, MarkStyle> = {
  loki: { glyph: '’', role: 'being.loki', fallback: 'magenta' },
  archivist: { glyph: '≡', role: 'being.archivist', fallback: 'violet' },
  cat: { glyph: '⌐', role: 'being.cat', fallback: 'orange' },
  ghost: { glyph: '°', role: 'mark.ghost', fallback: 'fg' },
  visitor: { glyph: ',', role: 'being.visitor', fallback: 'cyan' },
};

export const DEFAULT_MARK_STYLE: MarkStyle = {
  glyph: '·',
  role: 'being.loki',
  fallback: 'magenta',
};
