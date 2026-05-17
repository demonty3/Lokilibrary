/**
 * Manifest validation. The LLM is constrained by the prompt, but constraints
 * are advisory — we validate every field server-side before handing the
 * manifest to the frontend.
 */

import { isValidArchetype, type TemplateId } from './whitelist';

export interface ManifestCastingEntry {
  appid: number;
  archetype: string;
  role: string;
  position: [number, number];
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
    const pos = e.position;
    if (
      !Array.isArray(pos) ||
      pos.length !== 2 ||
      typeof pos[0] !== 'number' ||
      typeof pos[1] !== 'number'
    ) {
      return { ok: false, reason: `bad position for appid ${e.appid}` };
    }
    casting.push({
      appid: e.appid,
      archetype: e.archetype,
      role: e.role,
      position: [pos[0], pos[1]],
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
