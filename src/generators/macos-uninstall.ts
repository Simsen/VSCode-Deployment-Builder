/**
 * macOS uninstall script — uninstall.sh.
 *
 * Removes VS Code app, the `code` shim, the LaunchAgent + bootstrap scaffolding.
 * Leaves per-user extensions and per-user settings.json intact — consistent
 * with Decision 9's user-wins stance.
 */

import type { Baseline } from '../lib/baseline-schema';
import { scriptBanner } from './shared';

export function generateMacOSUninstallScript(baseline: Baseline): string {
  const lines: string[] = [];
  lines.push('#!/bin/bash');
  lines.push(scriptBanner(baseline, 'macOS uninstall.sh — Intune macOS shell script'));
  lines.push('');
  lines.push('set -uo pipefail   # not -e — we want to continue past missing files');
  lines.push('');
  lines.push('# Unload the LaunchAgent for any logged-in user.');
  lines.push('current_user=$(stat -f "%Su" /dev/console 2>/dev/null || true)');
  lines.push('if [[ -n "$current_user" && "$current_user" != "root" ]]; then');
  lines.push('    uid=$(id -u "$current_user")');
  lines.push('    launchctl bootout "gui/$uid/dk.simsenblog.vscode-baseline" 2>/dev/null || true');
  lines.push('fi');
  lines.push('');
  lines.push('# Remove the app bundle and CLI shim.');
  lines.push('rm -rf "/Applications/Visual Studio Code.app"');
  lines.push('rm -f "/usr/local/bin/code"');
  lines.push('');
  lines.push('# Remove the LaunchAgent + bootstrap scaffolding.');
  lines.push('rm -f /Library/LaunchAgents/dk.simsenblog.vscode-baseline.plist');
  lines.push('rm -rf "/Library/Application Support/vscode-baseline"');
  lines.push('rm -f /tmp/vscode-baseline.log /tmp/vscode-baseline.err');
  lines.push('');
  lines.push('# Per-user extensions and settings.json stay — they belong to the user.');
  lines.push('echo "VS Code uninstalled. User-profile extensions and settings.json preserved."');
  lines.push('exit 0');

  return lines.join('\n') + '\n';

  void baseline;
}
