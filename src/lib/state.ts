/**
 * Global app state. One writable Svelte store holds the entire baseline; every
 * UI component subscribes and mutates through it. Simple and easy to reason
 * about for a tool of this size.
 *
 * Also handles initial load — if the URL hash contains a baseline, we restore
 * from it on app start; otherwise we begin from the empty default.
 */

import { writable, derived } from 'svelte/store';
import type { Baseline } from './baseline-schema';
import { emptyBaseline, normalizeBaseline } from './baseline-schema';
import { decodeFromHash, encodeToHash, encodedHashLength } from './url-hash';
import { generateBundle, type BundleFile } from '../generators';

function loadInitial(): Baseline {
  try {
    const fromHash = decodeFromHash(window.location.hash);
    if (fromHash) return normalizeBaseline(fromHash);
  } catch (err) {
    console.warn('Failed to decode baseline from URL hash:', err);
  }
  return emptyBaseline();
}

export const baseline = writable<Baseline>(loadInitial());

/** Derived: the full bundle of generated files for the current baseline. */
export const bundle = derived<typeof baseline, BundleFile[]>(baseline, ($b) => generateBundle($b));

/** Derived: how big the URL-hash form of the current baseline would be, in chars. */
export const hashSize = derived<typeof baseline, number>(baseline, ($b) => encodedHashLength($b));

/** ~2 KB practical URL cap; UI warns past this. */
export const HASH_WARN_THRESHOLD = 1800;

/** Update one key of the baseline immutably. */
export function patchBaseline(patch: Partial<Baseline>): void {
  baseline.update((b) => ({ ...b, ...patch }));
}

/** Update a nested object field (extensions, pinning, copilot, settings). */
export function patchExtensions(patch: Partial<Baseline['extensions']>): void {
  baseline.update((b) => ({ ...b, extensions: { ...b.extensions, ...patch } }));
}
export function patchPinning(patch: Partial<Baseline['pinning']>): void {
  baseline.update((b) => ({ ...b, pinning: { ...b.pinning, ...patch } }));
}
export function patchCopilot(patch: Partial<Baseline['copilot']>): void {
  baseline.update((b) => ({ ...b, copilot: { ...b.copilot, ...patch } }));
}
export function patchSettings(patch: Partial<Baseline['settings']>): void {
  baseline.update((b) => ({ ...b, settings: { ...b.settings, ...patch } }));
}

/** Write the current baseline into the URL hash so the user can bookmark/share. */
export function syncToUrlHash(): void {
  baseline.subscribe(($b) => {
    try {
      const hash = encodeToHash($b);
      history.replaceState(null, '', hash);
    } catch (err) {
      console.warn('Failed to sync baseline to URL hash:', err);
    }
  });
}

/** Reset everything to default. Used by the "New baseline" button. */
export function resetBaseline(): void {
  baseline.set(emptyBaseline());
  history.replaceState(null, '', window.location.pathname + window.location.search);
}
