/**
 * Shared helpers used by every generator. Kept tiny — when a helper grows
 * past ~20 lines or starts having a domain meaning, promote it to its own
 * file under src/lib/.
 */

import type { Baseline, MergeTask } from '../lib/baseline-schema';
import { COPILOT_DEFAULTS, COPILOT_ID, COPILOT_CHAT_ID } from '../lib/catalog';

/**
 * VS Code's Inno Setup defaults (the tasks that are checked-on in the
 * interactive installer). Anything in this list that's NOT in the user's
 * selected mergetasks gets explicitly disabled via the `!task` prefix in
 * /MERGETASKS, so an unattended deploy produces predictable behavior.
 */
const DEFAULT_INNO_TASKS: MergeTask[] = ['addtopath', 'runcode'];

export function computeMergeTasksString(picked: MergeTask[]): string {
  const parts: string[] = [...picked];
  for (const def of DEFAULT_INNO_TASKS) {
    if (!picked.includes(def)) parts.push(`!${def}`);
  }
  return parts.join(',');
}

/**
 * Resolve the final list of extension ids the bootstrap script should install.
 * Combines curated checks + custom entries + the Copilot Chat auto-add rule
 * from Decision 12, and dedupes.
 */
export function resolveExtensionInstallList(baseline: Baseline): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  function push(id: string) {
    const key = id.split('@')[0].toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(id);
    }
  }

  for (const id of baseline.extensions.curated) push(id);
  for (const id of baseline.extensions.custom) push(id);

  // Auto-add Copilot Chat when main Copilot is selected and includeChat is on.
  if (baseline.copilot.enabled && baseline.copilot.includeChat) {
    const hasMain = out.some(id => id.toLowerCase().startsWith(COPILOT_ID));
    const hasChat = out.some(id => id.toLowerCase().startsWith(COPILOT_CHAT_ID));
    if (hasMain && !hasChat) push(COPILOT_CHAT_ID);
  }

  return out;
}

/**
 * Resolve the final settings.json overlay. Combines the user's selected
 * settings with the Copilot defaults when Copilot is enabled + defaultsApplied.
 *
 * When VS Code or extension pinning is on, also turn off the auto-update
 * channels so the pin isn't silently undone.
 */
export function resolveSettingsOverlay(baseline: Baseline): Record<string, unknown> {
  const out: Record<string, unknown> = { ...baseline.settings };

  if (baseline.copilot.enabled && baseline.copilot.defaultsApplied) {
    for (const [k, v] of Object.entries(COPILOT_DEFAULTS)) {
      if (!(k in out)) out[k] = v;
    }
  }

  if (baseline.pinning.vscode) {
    out['update.mode'] = 'none';
  }
  if (baseline.pinning.extensions) {
    out['extensions.autoUpdate'] = false;
    out['extensions.autoCheckUpdates'] = false;
  }

  return out;
}

/**
 * Build the VS Code download URL. When pinning is on, use the specific
 * version's URL pattern; otherwise use /latest/. Per Decision 15, pinned
 * versions are entered manually by the admin — we don't fetch.
 */
export function vscodeDownloadUrl(
  baseline: Baseline,
  arch: 'win32-x64-user' | 'win32-x64' | 'darwin'
): string {
  const base = 'https://update.code.visualstudio.com';
  if (baseline.pinning.vscode && baseline.pinning.vscodeVersion) {
    return `${base}/${baseline.pinning.vscodeVersion}/${arch}/stable`;
  }
  return `${base}/latest/${arch}/stable`;
}

/** Indent every line of a string by `n` spaces. */
export function indent(text: string, n: number): string {
  const pad = ' '.repeat(n);
  return text
    .split('\n')
    .map(line => (line.length ? pad + line : line))
    .join('\n');
}

/**
 * Render a JS value as a PowerShell hashtable / array / scalar literal.
 * Supports: string, number, boolean, null, arrays, plain objects.
 * Used to embed the baseline settings into a PS script as a real $hashtable.
 */
export function toPowerShellLiteral(value: unknown, depth = 0): string {
  const pad = '    '.repeat(depth);
  const inner = '    '.repeat(depth + 1);

  if (value === null || value === undefined) return '$null';
  if (typeof value === 'boolean') return value ? '$true' : '$false';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;

  if (Array.isArray(value)) {
    if (value.length === 0) return '@()';
    const items = value.map(v => inner + toPowerShellLiteral(v, depth + 1));
    return `@(\n${items.join(',\n')}\n${pad})`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '@{}';
    const lines = entries.map(([k, v]) => {
      const safeKey = /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(k) ? k : `'${k.replace(/'/g, "''")}'`;
      return `${inner}${safeKey} = ${toPowerShellLiteral(v, depth + 1)}`;
    });
    return `@{\n${lines.join('\n')}\n${pad}}`;
  }

  return '$null';
}

/** Render a JS value as a bash-friendly JSON literal for shell scripts. */
export function toJsonLiteral(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/** Standard banner placed at the top of every generated script. */
export function scriptBanner(baseline: Baseline, role: string): string {
  return [
    `# ────────────────────────────────────────────────────────────────────`,
    `# ${role}`,
    `# Baseline: ${baseline.baselineName}`,
    `# Generated: ${new Date().toISOString()}`,
    `# Tool version: ${baseline.toolVersion}`,
    `# `,
    `# Generated by VS Code Builder — part of the Simsen Builder line.`,
    `# Edit at your own risk; regenerating from the baseline JSON is the`,
    `# supported way to update.`,
    `# ────────────────────────────────────────────────────────────────────`
  ].join('\n');
}
