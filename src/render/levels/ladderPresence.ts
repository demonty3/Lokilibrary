/**
 * Ladder presence (ladder identity pass, spec 2026-07-17) — which beings'
 * letters appear on which district card. Pure: consumed by the ladder
 * composition, fed by PixiApp from the live cell-pane registry.
 *
 * A whole-library pane (wingId null) counts as the HOME wing. When no cell
 * pane is live at all — the DEFAULT single-pane flow, where zooming out
 * unmounted the cell — the full (theme-filtered) cohort renders on home:
 * the roster spawns into root, so "they live at home" is true-enough, and
 * the map never goes lifeless. Presence is a mount-time snapshot by design
 * (the rungs are read-only and ticker-free).
 */
export function presenceByDistrict(
  homeId: string | null,
  live: ReadonlyArray<{ wingId: string | null; agentIds: readonly string[] }>,
  fallbackIds: readonly string[],
): ReadonlyMap<string, readonly string[]> {
  const out = new Map<string, string[]>();
  if (homeId === null) return out;
  if (live.length === 0) {
    if (fallbackIds.length > 0) out.set(homeId, [...fallbackIds]);
    return out;
  }
  for (const entry of live) {
    const district = entry.wingId ?? homeId;
    const bucket = out.get(district) ?? [];
    bucket.push(...entry.agentIds);
    out.set(district, bucket);
  }
  return out;
}
