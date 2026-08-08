/** Boxed caption for a found note, word-wrapped to `maxWidth` columns of
 *  interior text so the box fits inside rooms narrower than a single
 *  unwrapped line (rooms run ~24 tiles wide; authored notes run 40-90
 *  chars — an unwrapped line would blow straight through the room wall
 *  and off the screen). Monospace framing works because the whole
 *  surface is one bitmap font. Capped at 90 chars total before wrapping.
 *  Shared module (marginalia-on-land slice): the cell's found-note box
 *  and the land's reveal caption speak one frame dialect. */
export function captionFor(text: string, maxWidth: number): string {
  const lines = wrapNote(text, maxWidth);
  const boxWidth = Math.max(...lines.map((l) => l.length));
  const bar = '═'.repeat(boxWidth + 2);
  const body = lines.map((l) => `║ ${l.padEnd(boxWidth)} ║`).join('\n');
  return `╔${bar}╗\n${body}\n╚${bar}╝`;
}

/** The wrap alone, without the frame. Split out for the land's reveal, which
 *  deliberately wears NO frame — a boxed note reading as a speech bubble is the
 *  chatbot surface CLAUDE.md rules out, and the land's notes are marginalia.
 *  The cell's found-note box keeps the frame (its salience dialect), so this
 *  is the shared half and `captionFor` above is unchanged in output. */
export function wrapNote(text: string, maxWidth: number): string[] {
  const capped = text.length > 90 ? `${text.slice(0, 89)}…` : text;
  const width = Math.max(4, maxWidth);
  const words = capped.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if (w.length > width) {
      // Hard-break: a single token wider than the interior can't fit on
      // any line, wrapped or not — flush what's pending and slice the
      // token into width-sized chunks so the box never exceeds the
      // room-width clamp (`maxWidth`).
      if (line) {
        lines.push(line);
        line = '';
      }
      let i = 0;
      while (w.length - i > width) {
        lines.push(w.slice(i, i + width));
        i += width;
      }
      line = w.slice(i);
      continue;
    }
    const candidate = line ? `${line} ${w}` : w;
    if (candidate.length > width && line) {
      lines.push(line);
      line = w;
    } else {
      line = candidate;
    }
  }
  lines.push(line);
  return lines;
}
