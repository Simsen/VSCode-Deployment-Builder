/**
 * Parser for `code --list-extensions` paste import — DESIGN.md closing batch.
 *
 * Input: the verbatim output of `code --list-extensions` (or `--show-versions`)
 * from a reference machine. One id per line. May contain @version suffix if
 * --show-versions was used. Blank lines and comments tolerated.
 *
 * Output: a sorted list of valid ids, a list of lines we couldn't parse, and
 * a partition into "matches a curated catalog entry" vs "needs to go into the
 * custom free-text list."
 */

import { isValidExtensionId, stripVersion } from './baseline-schema';

export interface ParseResult {
  /** Parsed ids in input order, deduplicated. Includes @version if present. */
  valid: string[];
  /** Original lines (with line numbers) that weren't recognizable extension ids. */
  invalid: { line: number; content: string }[];
}

export interface CatalogPartition {
  /** Ids that match one of the catalog publisher.name combos (version stripped for matching). */
  curatedHits: string[];
  /** Ids that don't match the catalog — go into the custom free-text list. */
  custom: string[];
}

/** Parse a paste-in block. Whitespace and comment lines are skipped. */
export function parseExtensionPaste(input: string): ParseResult {
  const valid: string[] = [];
  const seen = new Set<string>();
  const invalid: { line: number; content: string }[] = [];

  const lines = input.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('#')) continue;     // Allow comments
    if (trimmed.startsWith('//')) continue;

    if (!isValidExtensionId(trimmed)) {
      invalid.push({ line: i + 1, content: raw });
      continue;
    }

    if (!seen.has(trimmed.toLowerCase())) {
      seen.add(trimmed.toLowerCase());
      valid.push(trimmed);
    }
  }

  return { valid, invalid };
}

/**
 * Given parsed ids + a list of curated ids, partition into curatedHits vs custom.
 * Matching is case-insensitive on the publisher.name portion (version ignored
 * for matching, but preserved on the output side when going to `custom`).
 */
export function partitionAgainstCatalog(
  ids: string[],
  catalogIds: string[]
): CatalogPartition {
  const catalogSet = new Set(catalogIds.map(id => stripVersion(id).toLowerCase()));
  const curatedHits: string[] = [];
  const custom: string[] = [];

  for (const id of ids) {
    const base = stripVersion(id).toLowerCase();
    if (catalogSet.has(base)) {
      // Push the catalog's canonical id (without version) for the curated hit —
      // curated checkboxes never pin (Decision 8b). If the user wants the pin,
      // they keep it as a custom entry.
      const hasVersion = id.indexOf('@') !== -1;
      if (hasVersion) {
        // Both: tick the curated box (latest) AND keep the pinned version as custom.
        // Rare case but technically correct.
        curatedHits.push(stripVersion(id));
        custom.push(id);
      } else {
        curatedHits.push(stripVersion(id));
      }
    } else {
      custom.push(id);
    }
  }

  return {
    curatedHits: dedupe(curatedHits),
    custom: dedupe(custom)
  };
}

function dedupe(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of arr) {
    const key = item.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}
