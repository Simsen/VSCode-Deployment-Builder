/**
 * Catalog loader and lookup helpers. The catalog is bundled at build time —
 * no runtime network calls per Decision 7. To refresh the catalog, edit
 * src/catalog/extensions.json and rebuild.
 */

import catalogJson from '../catalog/extensions.json';

export interface CatalogEntry {
  id: string;
  displayName: string;
  publisher: string;
  category: string;
  description: string;
  lastVerified: string;
}

export interface Catalog {
  lastReview: string;
  extensions: CatalogEntry[];
}

export const catalog: Catalog = catalogJson;

/** All catalog entry ids — used by the paste-import partitioner. */
export const catalogIds: string[] = catalog.extensions.map(e => e.id);

/** Group catalog entries by their declared category. Stable order. */
export function groupByCategory(): Map<string, CatalogEntry[]> {
  const out = new Map<string, CatalogEntry[]>();
  for (const entry of catalog.extensions) {
    const bucket = out.get(entry.category);
    if (bucket) bucket.push(entry);
    else out.set(entry.category, [entry]);
  }
  return out;
}

/** Look up a catalog entry by id, case-insensitive. */
export function findEntry(id: string): CatalogEntry | undefined {
  const lower = id.toLowerCase();
  return catalog.extensions.find(e => e.id.toLowerCase() === lower);
}

/**
 * Copilot-specific settings overlay — per Decision 12, applied automatically
 * when Copilot is enabled AND copilot.defaultsApplied is true.
 */
export const COPILOT_DEFAULTS = {
  'github.copilot.advanced.publicCodeMatching': 'block',
  'github.copilot.editor.enableAutoCompletions': true,
  'github.copilot.chat.welcomeMessage': 'never'
} as const;

export const COPILOT_ID = 'github.copilot';
export const COPILOT_CHAT_ID = 'github.copilot-chat';
