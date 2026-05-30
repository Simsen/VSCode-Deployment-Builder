/**
 * URL hash baseline serialization — Decision 10.
 *
 * Baselines round-trip through the URL fragment as gzip(JSON) → base64url, so
 * sharing a baseline is just sharing a link. Gzip buys ~3-4× compression on
 * typical baselines, which keeps us comfortably under the ~2 KB practical
 * browser URL cap.
 *
 * The 1800-character soft warning is in the App, not here — this module
 * just encodes/decodes faithfully and reports actual size so the UI can decide.
 */

import pako from 'pako';
import type { Baseline } from './baseline-schema';
import { validateBaseline } from './baseline-schema';

const HASH_KEY = 'b';

/** Convert a Uint8Array to URL-safe base64 (RFC 4648 §5: -, _, no padding). */
function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlToBytes(s: string): Uint8Array {
  // Pad back to base64 standard length
  let b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4;
  if (pad) b64 += '='.repeat(4 - pad);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Encode a baseline to a URL hash fragment (including the leading "#"). */
export function encodeToHash(baseline: Baseline): string {
  const json = JSON.stringify(baseline);
  const gz = pako.gzip(json);
  return `#${HASH_KEY}=${bytesToBase64Url(gz)}`;
}

/** Approximate encoded length so the UI can warn before URL-cap overflow. */
export function encodedHashLength(baseline: Baseline): number {
  return encodeToHash(baseline).length;
}

/**
 * Read a baseline back from `window.location.hash`. Returns null if no
 * recognizable baseline is present. Throws if the hash is present but corrupt.
 */
export function decodeFromHash(hash: string): Baseline | null {
  const match = hash.match(new RegExp(`[#&]${HASH_KEY}=([A-Za-z0-9_-]+)`));
  if (!match) return null;
  const bytes = base64UrlToBytes(match[1]);
  const json = pako.ungzip(bytes, { to: 'string' });
  const parsed: unknown = JSON.parse(json);
  validateBaseline(parsed);
  return parsed;
}
