---
description: Invoke when Lokilibrary slice work is finished and Harry signals it's done — "ship it", "that's the slice", "wrap this up", "close it out" — not only when he types /close-slice. Verifies typecheck + smoke, records in STATE.md, marks PLAN.md, queues the eyeball in TODO-USER.md.
argument-hint: [slice name]
---

Close the slice: $ARGUMENTS (if empty, infer the slice from this session's
work and confirm it with Harry before proceeding).

This encodes the project's own maintenance rules (PLAN.md header, CLAUDE.md,
STATE.md conventions). Order matters; do not skip the verification step.

1. **Verify before recording.** Run `npm run typecheck` and the slice's own
   `scripts/smoke-*.mts` script(s). Both must be green — typecheck + smoke
   are the ground truth here. If anything is red, the slice is not closing;
   report what is red and stop.
2. **STATE.md gets the record.** Update the present-tense snapshot: what
   shipped, the evidence (smoke names, commit if committed), any frozen bars
   or kill conditions carried by this slice — bars inherit verbatim, never
   softened. STATE.md is authoritative; write it as the present tense of the
   project, not a changelog entry.
3. **PLAN.md gets the status mark — and only PLAN.md.** Update the slice's
   status in the ladder/backlog there. Never edit design reviews or RETROS/;
   those are frozen records (new documents only, per the maintenance rule).
4. **Queue the human gate.** Mark the eyeball status: PENDING until Harry
   has looked, PASSED only when he has said so in his own words. If the
   slice needs him to look at something specific, add it to TODO-USER.md
   with what to look at and what would fail it.
5. **Report** in a few sentences: what closed, the evidence, what the
   eyeball should check, and what the next slice in the ladder is.
