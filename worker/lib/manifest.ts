/**
 * Manifest validation. The LLM is constrained by the prompt, but constraints
 * are advisory — we validate every field server-side before handing the
 * manifest to the frontend.
 *
 * Phase 5 slice 2: `position` is no longer part of the manifest contract.
 * Placement is derived client-side from the behavioral profile
 * (src/procedural/seaside.ts). If the LLM hallucinates a position field
 * anyway, the validator silently drops it — the renderer doesn't read it.
 * Cache key bumped from `manifest:` to `manifest:v2:` in worker/index.ts so
 * pre-Phase-5 cached manifests are orphaned.
 */

import { isValidArchetype, type TemplateId } from './whitelist';

export interface ManifestCastingEntry {
  appid: number;
  archetype: string;
  role: string;
}

export interface Manifest {
  template: TemplateId;
  metaphor: string;
  casting: ManifestCastingEntry[];
}

export interface ValidationFailure {
  ok: false;
  reason: string;
}
export interface ValidationSuccess {
  ok: true;
  manifest: Manifest;
}
export type ValidationResult = ValidationFailure | ValidationSuccess;

export function validateManifest(
  template: TemplateId,
  allowedAppids: Set<number>,
  raw: unknown,
): ValidationResult {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'manifest is not an object' };
  const obj = raw as Record<string, unknown>;
  const metaphor = obj.metaphor;
  if (typeof metaphor !== 'string' || metaphor.length === 0) {
    return { ok: false, reason: 'metaphor missing' };
  }
  const castingRaw = obj.casting;
  if (!Array.isArray(castingRaw)) return { ok: false, reason: 'casting is not an array' };
  const casting: ManifestCastingEntry[] = [];
  const seenAppids = new Set<number>();
  for (const entry of castingRaw) {
    if (!entry || typeof entry !== 'object') {
      return { ok: false, reason: 'casting entry is not an object' };
    }
    const e = entry as Record<string, unknown>;
    if (typeof e.appid !== 'number' || !allowedAppids.has(e.appid)) {
      return { ok: false, reason: `casting entry has unknown appid ${String(e.appid)}` };
    }
    if (seenAppids.has(e.appid)) {
      return { ok: false, reason: `casting entry repeats appid ${e.appid}` };
    }
    seenAppids.add(e.appid);
    if (typeof e.archetype !== 'string' || !isValidArchetype(template, e.archetype)) {
      return { ok: false, reason: `unknown archetype "${String(e.archetype)}" for appid ${e.appid}` };
    }
    if (typeof e.role !== 'string' || e.role.length === 0) {
      return { ok: false, reason: `missing role for appid ${e.appid}` };
    }
    // Any `position` field the LLM hallucinates is silently dropped — we don't
    // put it on the validated manifest. Phase 5 procedural layer owns placement.
    casting.push({
      appid: e.appid,
      archetype: e.archetype,
      role: e.role,
    });
  }
  if (casting.length === 0) return { ok: false, reason: 'casting is empty' };
  return { ok: true, manifest: { template, metaphor, casting } };
}

/**
 * Best-effort JSON extraction. Some local LLMs (Qwen, Llama variants) wrap
 * their output in markdown fences despite the prompt. Strip a single fence
 * if present; otherwise pass through.
 */
export function extractJson(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith('```')) {
    const firstNewline = trimmed.indexOf('\n');
    if (firstNewline === -1) return trimmed;
    const lastFence = trimmed.lastIndexOf('```');
    if (lastFence <= firstNewline) return trimmed.slice(firstNewline + 1);
    return trimmed.slice(firstNewline + 1, lastFence).trim();
  }
  return trimmed;
}
