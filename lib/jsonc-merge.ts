/**
 * Settings.json merge — Decision 9 (user-wins).
 *
 * The bootstrap script needs to merge the baseline's settings overlay into a
 * user's existing settings.json without destroying their customizations. The
 * model is: baseline keys are *defaults*. User keys always survive. A managed-
 * keys sidecar tracks which keys we've ever set, so on subsequent runs we
 * know which keys are "ours" (and may need updating) vs "the user's" (leave alone).
 *
 * v1 accepts comment loss (Decision 9 limitation): JSONC comments and trailing
 * commas in the user's existing settings.json will be lost on merge. Documented;
 * fixable in v1.1 if someone complains.
 *
 * This module is used in TWO places:
 *   1. The bootstrap scripts we generate (re-implemented in PowerShell / bash).
 *   2. Pure JS validation inside the tool itself, for the diff/preview UX.
 *
 * Keep the algorithm simple enough to port faithfully to PowerShell.
 */

import type { SettingsOverlay } from './baseline-schema';

/**
 * Strip JSONC comments and trailing commas so JSON.parse can read VS Code's
 * settings.json. Handles both line comments and block comments. Lossy: any
 * comments in the input are gone after this passes through.
 *
 * String-content-aware: comment markers that appear INSIDE a string literal
 * are preserved (we don't strip them, since they're part of the data).
 */
export function stripJsonc(input: string): string {
  let out = '';
  let i = 0;
  const n = input.length;
  let inString = false;
  let stringQuote = '';

  while (i < n) {
    const ch = input[i];
    const next = input[i + 1];

    if (inString) {
      out += ch;
      if (ch === '\\' && i + 1 < n) {
        // Escape sequence — copy the next char verbatim
        out += input[i + 1];
        i += 2;
        continue;
      }
      if (ch === stringQuote) inString = false;
      i++;
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      stringQuote = ch;
      out += ch;
      i++;
      continue;
    }

    if (ch === '/' && next === '/') {
      // Line comment — skip to newline
      while (i < n && input[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && next === '*') {
      // Block comment — skip to */
      i += 2;
      while (i < n && !(input[i] === '*' && input[i + 1] === '/')) i++;
      i += 2;
      continue;
    }

    out += ch;
    i++;
  }

  // Strip trailing commas before } or ]
  return out.replace(/,(\s*[}\]])/g, '$1');
}

/**
 * Result of a settings merge.
 *
 * - `merged` is the settings.json content to write.
 * - `managedKeys` is the new sidecar contents — the union of (previously
 *   managed keys) and (keys present in the baseline). This is what the bootstrap
 *   script must persist alongside settings.json.
 */
export interface MergeResult {
  merged: SettingsOverlay;
  managedKeys: string[];
}

/**
 * User-wins merge.
 *
 * For each key in `baseline`:
 *   - If the user has NOT customized this key (it's not in `userExisting`, OR
 *     it's in `userExisting` with the same value the baseline last set it to),
 *     apply the baseline value.
 *   - If the user has customized it (it's in `userExisting` AND the value
 *     differs from what `priorManaged` recorded), leave the user value alone.
 *
 * For each key in `userExisting` that isn't in `baseline`: keep it.
 *
 * `priorManaged` is the previous run's managed-keys list. Without it, we
 * can't distinguish "user set this" from "we set this on the last run."
 *
 * On the FIRST run (priorManaged is empty), behavior is: baseline values are
 * applied as defaults for keys the user hasn't set, otherwise user values win.
 * This is the right behavior for the case where someone already has VS Code
 * installed with their own settings before our deployment ever runs.
 */
export function mergeSettings(
  baseline: SettingsOverlay,
  userExisting: SettingsOverlay,
  priorManaged: string[]
): MergeResult {
  const managedSet = new Set(priorManaged);
  const merged: SettingsOverlay = { ...userExisting };

  for (const key of Object.keys(baseline)) {
    const userHas = Object.prototype.hasOwnProperty.call(userExisting, key);
    if (!userHas) {
      // User hasn't set this — apply baseline as default
      merged[key] = baseline[key];
      managedSet.add(key);
    } else {
      // User has a value. Was it set by us last time?
      // We can't reconstruct the prior baseline value, so the rule is simpler:
      // if the key is in priorManaged AND the current user value equals our
      // current baseline value, treat it as "still ours" and refresh.
      // Otherwise treat it as the user's and leave alone.
      if (managedSet.has(key) && deepEqual(userExisting[key], baseline[key])) {
        merged[key] = baseline[key];
      }
      // else: user customized it — leave merged[key] = userExisting[key]
      managedSet.add(key);
    }
  }

  return {
    merged,
    managedKeys: Array.from(managedSet).sort()
  };
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (typeof a !== 'object') return false;
  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (!deepEqual(aObj[k], bObj[k])) return false;
  }
  return true;
}

/**
 * Parse a settings.json string (JSONC tolerated) into an object.
 * Returns {} for empty/invalid input — the caller has to decide whether to
 * surface an error.
 */
export function parseSettingsJsonc(input: string): SettingsOverlay {
  const trimmed = input.trim();
  if (!trimmed) return {};
  try {
    const stripped = stripJsonc(trimmed);
    const parsed: unknown = JSON.parse(stripped);
    return typeof parsed === 'object' && parsed !== null ? (parsed as SettingsOverlay) : {};
  } catch {
    return {};
  }
}
