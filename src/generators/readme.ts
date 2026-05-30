/**
 * Per-bundle README — generated alongside the scripts.
 *
 * This is load-bearing documentation, not decoration. Without it, admins
 * deploy only the SYSTEM script, miss the user-context script, and complain
 * that extensions never install.
 */

import type { Baseline } from '../lib/baseline-schema';
import { resolveExtensionInstallList } from './shared';

export function generateBundleReadme(baseline: Baseline): string {
  const extensions = resolveExtensionInstallList(baseline);
  const platforms = baseline.platforms.join(' + ');
  const pinNote = baseline.pinning.vscode && baseline.pinning.vscodeVersion
    ? `VS Code pinned to **${baseline.pinning.vscodeVersion}**.`
    : 'VS Code installs **latest** stable.';

  const sections: string[] = [];

  sections.push(`# ${baseline.baselineName}`);
  sections.push('');
  sections.push(`Generated ${new Date().toISOString().slice(0, 10)} by VS Code Builder (tool v${baseline.toolVersion}). Platforms: ${platforms}. ${pinNote} ${extensions.length} extension(s) in the baseline.`);
  if (baseline.notes) {
    sections.push('');
    sections.push(`> ${baseline.notes}`);
  }
  sections.push('');
  sections.push('## What\'s in this bundle');
  sections.push('');
  sections.push('A complete VS Code deployment for managed endpoints. The architecture decouples machine-level install (SYSTEM context) from user-level configuration (user context) so per-user concerns — extensions, settings.json, Copilot sign-in — happen where they should: in the user\'s own session.');
  sections.push('');

  if (baseline.platforms.includes('windows')) {
    sections.push('### Windows');
    sections.push('');
    sections.push('| File | Purpose | Where to deploy |');
    sections.push('| ---- | ------- | --------------- |');
    sections.push('| `windows/install-system.ps1` | Installs VS Code per-machine | Intune Win32 app — SYSTEM context |');
    sections.push('| `windows/detect-installed.ps1` | Detects whether VS Code is installed | Intune Win32 app detection rule |');
    sections.push('| `windows/uninstall.ps1` | Removes VS Code + scaffolding | Intune Win32 app uninstall |');
    sections.push('| `windows/configure-user.ps1` | Installs extensions + applies settings per user | Intune PowerShell Script — assigned to user groups |');
    sections.push('| `windows/detect-baseline.ps1` + `apply-baseline.ps1` | Same per-user logic for Endpoint Analytics | Intune Proactive Remediations (requires E3/E5/F3 or Intune P1) |');
    sections.push('');
    sections.push('Deploy the Win32 app first (one-time per device), then the user script (one-time per user, or as Proactive Remediation for ongoing drift catch-up).');
    sections.push('');
  }

  if (baseline.platforms.includes('macos')) {
    sections.push('### macOS');
    sections.push('');
    sections.push('| File | Purpose | Where to deploy |');
    sections.push('| ---- | ------- | --------------- |');
    sections.push('| `macos/install-system.sh` | Installs VS Code + LaunchAgent | Intune macOS shell script — SYSTEM context |');
    sections.push('| `macos/uninstall.sh` | Removes VS Code + LaunchAgent + shim | Uninstall script |');
    sections.push('| `macos/configure-user.sh` | Refreshes baseline for an existing user | Intune macOS shell script — user context |');
    sections.push('');
    sections.push('The SYSTEM script drops a LaunchAgent that bootstraps each user automatically on first login. For users who logged in before deployment ran, push `configure-user.sh` via the user-context macOS shell script channel.');
    sections.push('');
    sections.push('Two macOS-specific landmines worth knowing:');
    sections.push('');
    sections.push('1. **The `code` CLI shim** is normally created only when the user runs the Command Palette "Shell Command: Install \'code\'" action. Our install script creates `/usr/local/bin/code` manually so per-user extension installs work. Don\'t remove it.');
    sections.push('2. **LaunchAgent timing.** Extension installs need network access; the bootstrap waits up to 60s for `marketplace.visualstudio.com` to be reachable before running `code --install-extension`. On managed Macs with restricted proxies, allowlist this domain.');
    sections.push('');
  }

  sections.push('### Plain PowerShell');
  sections.push('');
  sections.push('`plain/vscode-baseline.ps1` is a single interactive script for non-Intune use — hand to a developer to run themselves on a Windows machine. Uses winget when available. Does install + extensions + settings.json in one shot. Not idempotent in the same way as the user-context script (this one overwrites settings.json — see Decision 9 in the design doc for the merge story).');
  sections.push('');

  sections.push('## Extension list');
  sections.push('');
  for (const id of extensions) sections.push(`- \`${id}\``);
  sections.push('');

  if (baseline.copilot.enabled) {
    sections.push('## Copilot');
    sections.push('');
    sections.push('Copilot is enabled in this baseline. Three things to know:');
    sections.push('');
    sections.push('1. **Auth cannot be scripted.** The user will see a sign-in prompt the first time they open VS Code. Ensure the user has a Copilot license assigned in your Azure tenant before they attempt sign-in — otherwise they bounce off an unhelpful error.');
    sections.push('2. **Copilot Chat** is auto-installed alongside the main extension. Disable via the baseline\'s "Include Chat companion" toggle if not wanted.');
    sections.push('3. **Org defaults** for telemetry, public code matching, and chat welcome are pre-applied in `settings.json`. Review them before deploying to regulated environments — they may need to align with your org\'s Copilot policy.');
    sections.push('');
  }

  sections.push('## Updating this baseline');
  sections.push('');
  sections.push('Open the `baseline.json` file in [VS Code Builder](https://simsenblog.dk/vscode-builder/) to edit it visually, then regenerate the bundle. The baseline JSON is the canonical source — the scripts are derived.');
  sections.push('');
  sections.push('To roll a baseline update out to existing users: bump the Intune assignment\'s script version (or duplicate-and-re-assign for PS Script channel; for Proactive Remediations, the next scheduled run picks it up automatically).');
  sections.push('');
  sections.push('---');
  sections.push('');
  sections.push('Generated by VS Code Builder. Part of the [Simsen Builder line](https://simsenblog.dk/).');

  return sections.join('\n') + '\n';
}
