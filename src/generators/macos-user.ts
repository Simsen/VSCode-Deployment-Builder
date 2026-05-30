/**
 * macOS USER-context configure script — configure-user.sh.
 *
 * Deployed via Intune's macOS shell script channel with user context. Parallel
 * to the Windows configure-user.ps1 — for the "user already has VS Code, or
 * we want to refresh their baseline" case. Unlike the LaunchAgent (which fires
 * once per user via sentinel), this script is idempotent and meant to be
 * re-runnable.
 *
 * Implements the full user-wins merge logic on settings.json using a Python
 * helper (Python 3 is preinstalled on every modern macOS).
 */

import type { Baseline } from '../lib/baseline-schema';
import {
  resolveExtensionInstallList,
  resolveSettingsOverlay,
  scriptBanner
} from './shared';

export function generateMacOSUserScript(baseline: Baseline): string {
  const extensions = resolveExtensionInstallList(baseline);
  const settings = resolveSettingsOverlay(baseline);

  const settingsJson = JSON.stringify(settings, null, 2);
  const extensionsList = extensions.join('\n');

  const lines: string[] = [];
  lines.push('#!/bin/bash');
  lines.push(scriptBanner(baseline, 'macOS configure-user.sh — USER context'));
  lines.push('');
  lines.push('set -euo pipefail');
  lines.push('');
  lines.push('SETTINGS_PATH="$HOME/Library/Application Support/Code/User/settings.json"');
  lines.push('SIDECAR_PATH="$HOME/Library/Application Support/Code/User/.baseline-managed-keys.json"');
  lines.push('mkdir -p "$(dirname "$SETTINGS_PATH")"');
  lines.push('');
  lines.push('# ─── Wait for the `code` CLI ─────────────────────────────────────────');
  lines.push('for i in 1 2 3 4 5 6 7 8 9 10 11 12; do');
  lines.push('    if command -v code >/dev/null 2>&1; then break; fi');
  lines.push('    sleep 5');
  lines.push('done');
  lines.push('if ! command -v code >/dev/null 2>&1; then');
  lines.push('    echo "VS Code code CLI not found — skipping baseline apply."');
  lines.push('    exit 0');
  lines.push('fi');
  lines.push('');
  lines.push('# ─── Install / update extensions ─────────────────────────────────────');
  lines.push("cat > /tmp/baseline-extensions.txt << 'EXT_EOF'");
  lines.push(extensionsList);
  lines.push('EXT_EOF');
  lines.push('');
  lines.push('while IFS= read -r ext; do');
  lines.push('    [[ -z "$ext" ]] && continue');
  lines.push('    echo "Installing extension: $ext"');
  lines.push('    code --install-extension "$ext" --force >/dev/null 2>&1 || true');
  lines.push('done < /tmp/baseline-extensions.txt');
  lines.push('rm -f /tmp/baseline-extensions.txt');
  lines.push('');
  lines.push('# ─── Merge settings.json (user-wins) ─────────────────────────────────');
  lines.push("cat > /tmp/baseline-settings.json << 'BASELINE_EOF'");
  lines.push(settingsJson);
  lines.push('BASELINE_EOF');
  lines.push('');
  lines.push('# Python3 is preinstalled on macOS; we use it for the merge so we don\'t');
  lines.push('# have to implement JSON parsing in bash. JSONC comments and trailing');
  lines.push('# commas in the existing settings.json are stripped (v1 limitation per');
  lines.push('# Decision 9 — comments are lost on merge).');
  lines.push('python3 << \'PYTHON_EOF\'');
  lines.push('import json, os, re, sys');
  lines.push('');
  lines.push('settings_path = os.path.expanduser("~/Library/Application Support/Code/User/settings.json")');
  lines.push('sidecar_path  = os.path.expanduser("~/Library/Application Support/Code/User/.baseline-managed-keys.json")');
  lines.push('');
  lines.push('with open("/tmp/baseline-settings.json") as f:');
  lines.push('    baseline = json.load(f)');
  lines.push('');
  lines.push('existing = {}');
  lines.push('if os.path.exists(settings_path):');
  lines.push('    raw = open(settings_path).read()');
  lines.push('    stripped = re.sub(r"/\\*.*?\\*/", "", raw, flags=re.S)');
  lines.push('    stripped = re.sub(r"//.*$", "", stripped, flags=re.M)');
  lines.push('    stripped = re.sub(r",(\\s*[}\\]])", r"\\1", stripped)');
  lines.push('    try:');
  lines.push('        existing = json.loads(stripped)');
  lines.push('    except Exception:');
  lines.push('        existing = {}');
  lines.push('');
  lines.push('prior_managed = []');
  lines.push('if os.path.exists(sidecar_path):');
  lines.push('    try:');
  lines.push('        prior_managed = json.load(open(sidecar_path))');
  lines.push('    except Exception:');
  lines.push('        prior_managed = []');
  lines.push('managed = set(prior_managed)');
  lines.push('');
  lines.push('merged = dict(existing)');
  lines.push('for key, base_val in baseline.items():');
  lines.push('    if key not in existing:');
  lines.push('        merged[key] = base_val');
  lines.push('    else:');
  lines.push('        # Refresh only if user value matches what we previously set.');
  lines.push('        if key in managed and existing[key] == base_val:');
  lines.push('            merged[key] = base_val');
  lines.push('        # else: user customized — leave existing[key]');
  lines.push('    managed.add(key)');
  lines.push('');
  lines.push('os.makedirs(os.path.dirname(settings_path), exist_ok=True)');
  lines.push('with open(settings_path, "w") as f:');
  lines.push('    json.dump(merged, f, indent=2)');
  lines.push('with open(sidecar_path, "w") as f:');
  lines.push('    json.dump(sorted(managed), f)');
  lines.push('');
  lines.push('print(f"Baseline applied. Managed keys: {len(managed)}")');
  lines.push('PYTHON_EOF');
  lines.push('');
  lines.push('rm -f /tmp/baseline-settings.json');

  if (baseline.copilot.enabled) {
    lines.push('');
    lines.push('# Copilot extension installed above. The user will see a sign-in prompt');
    lines.push('# on first launch — auth flows cannot be scripted (Decision 12).');
  }

  lines.push('');
  lines.push('exit 0');

  return lines.join('\n') + '\n';
}
