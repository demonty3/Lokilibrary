/**
 * Shared smoke-test utilities. Extracted in slice 5H from patterns
 * copy-pasted across the Phase 4 + Phase 5A smokes. Each smoke
 * importing from here saves ~30 lines of boilerplate and prevents
 * drift between checker behaviors / mock shapes.
 *
 * Two helpers:
 *   - `makeChecker(label)` — returns `{check, report}`. check(label,
 *     cond, detail?) accumulates pass/fail. report() prints the
 *     summary line + any failures, then process.exit(1) on any
 *     failure. The label appears in the summary line as
 *     `[<label>] N assertions passed[, M failed]`.
 *   - `mockElectronModule(exports)` — hijacks `Module._load` so any
 *     `require('electron')` returns the provided exports object.
 *     The whole-codebase pattern for "test code that imports from
 *     electron" in WSL where the real electron binary isn't present.
 *     CALL BEFORE importing any module that does `from 'electron'`.
 *
 * Both helpers are pure-Node, no deps. Import from `./lib/smoke.ts`
 * relative to scripts/.
 */

import { Module } from 'node:module';

export interface Checker {
  /** Record an assertion. Pass + return, or accumulate the failure
   *  with an optional detail string for the report. */
  check(label: string, cond: boolean, detail?: string): void;
  /** Print the summary line. If any assertion failed, also print the
   *  failure list and exit non-zero. Call once at the end of the
   *  smoke. */
  report(): void;
  /** Snapshot of the accumulator. Useful for sub-section reports
   *  without calling report() (which exits on failure). */
  state(): { passed: number; failures: readonly string[] };
}

/** Build a checker scoped to one smoke. Label appears in the report
 *  summary line. Call report() at the bottom of the smoke. */
export function makeChecker(label: string): Checker {
  const passed = { n: 0 };
  const failures: string[] = [];
  return {
    check(assertionLabel, cond, detail) {
      if (cond) {
        passed.n++;
        return;
      }
      failures.push(`[FAIL] ${assertionLabel}${detail ? ` — ${detail}` : ''}`);
    },
    report() {
      // eslint-disable-next-line no-console
      console.log(
        `\n[${label}] ${passed.n} assertions passed${failures.length ? `, ${failures.length} failed` : ''}`,
      );
      if (failures.length > 0) {
        for (const f of failures) {
          // eslint-disable-next-line no-console
          console.error(`  ${f}`);
        }
        process.exit(1);
      }
    },
    state() {
      return { passed: passed.n, failures };
    },
  };
}

/**
 * Hijack Node's module loader so any `require('electron')` returns
 * the provided mock. Used by smokes that need to import modules that
 * import from `electron` (e.g. `desktop/src/config.ts` which calls
 * `app.getPath('userData')`).
 *
 * MUST be called BEFORE the test imports the module under test —
 * Module._load is checked at require time, not call time. Idempotent;
 * the original loader is preserved + restored on each call so a
 * second call with new mock exports works.
 *
 * Example:
 * ```
 * const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lokilib-'));
 * mockElectronModule({ app: { getPath: () => tmpDir } });
 * const config = await import('../desktop/src/config.ts');
 * // config.getMode() etc. work against the mocked userData dir
 * ```
 */
export function mockElectronModule(exports: Record<string, unknown>): void {
  type ModuleLoad = (this: unknown, request: string, ...rest: unknown[]) => unknown;
  interface ModuleWithLoad { _load: ModuleLoad }
  const mod = Module as unknown as ModuleWithLoad;
  const original = (mod as { _loadOriginal?: ModuleLoad })._loadOriginal ?? mod._load;
  (mod as { _loadOriginal?: ModuleLoad })._loadOriginal = original;
  mod._load = function (request, ...args) {
    if (request === 'electron') return exports;
    return original.call(this, request, ...args);
  };
}
