/**
 * Baseline schema — canonical data structure for a VS Code deployment baseline.
 *
 * Locked at schemaVersion 1 per DESIGN.md, Decision 10. Every v1.x feature
 * (diff view, importer evolution, history view) consumes this. Versioning is
 * explicit via `schemaVersion` so future tool versions can migrate v1 baselines
 * without a messy fork.
 */

export type Platform = 'windows' | 'macos';
export type Channel = 'stable';                 // Insiders deferred per Decision 13
export type Scope = 'machine' | 'user';
export type InstallSource = 'bootstrapper' | 'winget' | 'pkg';

export interface PinningConfig {
  vscode: boolean;
  vscodeVersion: string | null;   // manual entry per Decision 15 — null when not pinned
  extensions: boolean;            // per-extension @version syntax per Decision 8b
}

export interface ExtensionsConfig {
  curated: string[];              // ids selected from the curated catalog
  custom: string[];               // free-text entries — may include @version suffix
}

export interface CopilotConfig {
  enabled: boolean;
  includeChat: boolean;           // auto-true when enabled, opt-out via Advanced
  defaultsApplied: boolean;       // whether the Copilot-specific settings overlay is included
}

/**
 * settings.json overlay. Keys are dotted VS Code setting names
 * (e.g. "telemetry.telemetryLevel"). Values are whatever VS Code expects.
 */
export type SettingsOverlay = Record<string, unknown>;

/**
 * MERGETASKS controls /MERGETASKS for the Inno Setup installer on Windows.
 * Mapped 1:1 to Inno task IDs documented at
 * https://code.visualstudio.com/docs/setup/windows#_unattended-setup
 */
export type MergeTask =
  | 'addtopath'
  | 'addcontextmenufiles'
  | 'addcontextmenufolders'
  | 'associatewithfiles'
  | 'runcode';                    // off by default for unattended (Decision in original doc)

export interface Baseline {
  schemaVersion: 1;
  toolVersion: string;
  baselineName: string;
  createdAt: string;              // ISO 8601
  platforms: Platform[];
  channel: Channel;
  scope: Scope;
  mergetasks: MergeTask[];
  pinning: PinningConfig;
  extensions: ExtensionsConfig;
  settings: SettingsOverlay;
  copilot: CopilotConfig;
  notes: string;
}

export const TOOL_VERSION = '0.1.0';

/**
 * Reasonable v1 defaults for the Simple view. Advanced view can override anything.
 * These reflect the Decision 6 "opinionated default + advanced disclosure" UX:
 * the defaults are the ones we believe most Intune admins want.
 */
export function emptyBaseline(): Baseline {
  return {
    schemaVersion: 1,
    toolVersion: TOOL_VERSION,
    baselineName: 'My VS Code baseline',
    createdAt: new Date().toISOString(),
    platforms: ['windows'],
    channel: 'stable',
    scope: 'machine',
    mergetasks: ['addtopath', 'addcontextmenufiles', 'addcontextmenufolders'],
    pinning: { vscode: false, vscodeVersion: null, extensions: false },
    extensions: { curated: [], custom: [] },
    settings: {
      'telemetry.telemetryLevel': 'off',
      'editor.formatOnSave': true,
      'update.mode': 'default'
    },
    copilot: { enabled: false, includeChat: true, defaultsApplied: true },
    notes: ''
  };
}

/**
 * Lightweight runtime validation — no zod dependency. Throws on the first
 * structural problem with a message specific enough to point at the bad key.
 * Used on import to refuse malformed JSON cleanly rather than corrupting state.
 */
export function validateBaseline(input: unknown): asserts input is Baseline {
  if (typeof input !== 'object' || input === null) {
    throw new Error('Baseline must be an object');
  }
  const b = input as Record<string, unknown>;

  if (b.schemaVersion !== 1) {
    throw new Error(`Unsupported schemaVersion: ${String(b.schemaVersion)} (this tool supports 1)`);
  }
  if (typeof b.baselineName !== 'string') throw new Error('baselineName must be a string');
  if (typeof b.createdAt !== 'string') throw new Error('createdAt must be a string');
  if (!Array.isArray(b.platforms)) throw new Error('platforms must be an array');
  for (const p of b.platforms as unknown[]) {
    if (p !== 'windows' && p !== 'macos') {
      throw new Error(`Unknown platform: ${String(p)}`);
    }
  }
  if (b.channel !== 'stable') throw new Error(`Unsupported channel: ${String(b.channel)}`);
  if (b.scope !== 'machine' && b.scope !== 'user') {
    throw new Error(`Unknown scope: ${String(b.scope)}`);
  }
  if (!Array.isArray(b.mergetasks)) throw new Error('mergetasks must be an array');

  const pin = b.pinning as Record<string, unknown> | undefined;
  if (!pin || typeof pin !== 'object') throw new Error('pinning must be an object');
  if (typeof pin.vscode !== 'boolean') throw new Error('pinning.vscode must be a boolean');
  if (pin.vscodeVersion !== null && typeof pin.vscodeVersion !== 'string') {
    throw new Error('pinning.vscodeVersion must be a string or null');
  }
  if (typeof pin.extensions !== 'boolean') throw new Error('pinning.extensions must be a boolean');

  const ext = b.extensions as Record<string, unknown> | undefined;
  if (!ext || typeof ext !== 'object') throw new Error('extensions must be an object');
  if (!Array.isArray(ext.curated)) throw new Error('extensions.curated must be an array');
  if (!Array.isArray(ext.custom)) throw new Error('extensions.custom must be an array');

  if (typeof b.settings !== 'object' || b.settings === null) {
    throw new Error('settings must be an object');
  }

  const cop = b.copilot as Record<string, unknown> | undefined;
  if (!cop || typeof cop !== 'object') throw new Error('copilot must be an object');
  if (typeof cop.enabled !== 'boolean') throw new Error('copilot.enabled must be a boolean');
  if (typeof cop.includeChat !== 'boolean') throw new Error('copilot.includeChat must be a boolean');
  if (typeof cop.defaultsApplied !== 'boolean') throw new Error('copilot.defaultsApplied must be a boolean');

  if (typeof b.notes !== 'string') throw new Error('notes must be a string');
}

/**
 * Normalize a baseline after import / hash decode. The schema is wide enough
 * to allow multiple platforms (so older baselines aren't rejected), but the
 * UI enforces single-platform-per-baseline. Truncate to the first platform
 * if multiple were stored.
 */
export function normalizeBaseline(b: Baseline): Baseline {
  if (b.platforms.length > 1) {
    return { ...b, platforms: [b.platforms[0]] };
  }
  if (b.platforms.length === 0) {
    return { ...b, platforms: ['windows'] };
  }
  return b;
}

/**
 * Validate a single extension id, with optional @version suffix.
 * VS Code marketplace ids are publisher.name where each part is alphanumeric +
 * dashes. Version, if present, is semver-ish.
 */
export const EXTENSION_ID_RE = /^[a-z0-9][a-z0-9-]*\.[a-z0-9][a-z0-9-]*(@[\d.]+)?$/i;

export function isValidExtensionId(id: string): boolean {
  return EXTENSION_ID_RE.test(id.trim());
}

/**
 * Strip an @version suffix, returning just publisher.name. Used to detect
 * duplicates between curated checkboxes (never pinned) and custom entries.
 */
export function stripVersion(id: string): string {
  const at = id.indexOf('@');
  return at === -1 ? id : id.slice(0, at);
}
