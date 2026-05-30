/**
 * Win32 uninstall script — uninstall.ps1.
 *
 * Removes VS Code itself plus the scaffolding the install-system.ps1 dropped
 * (Default-profile seeded files). Per Decision 9, leaves USER-profile extensions
 * and USER settings.json intact — those belong to the user, not the org.
 */

import type { Baseline } from '../lib/baseline-schema';
import { scriptBanner } from './shared';

export function generateWindowsUninstallScript(baseline: Baseline): string {
  const lines: string[] = [];
  lines.push(scriptBanner(baseline, 'Windows uninstall.ps1 — Intune Win32 uninstall'));
  lines.push('');
  lines.push('#Requires -RunAsAdministrator');
  lines.push("$ErrorActionPreference = 'Continue'");
  lines.push('');
  lines.push('# Look up the VS Code uninstall string from the registry.');
  lines.push("$uninstallKeys = @(");
  lines.push("    'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{EA457B21-F73E-494C-ACAB-524FDE069978}_is1',");
  lines.push("    'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{EA457B21-F73E-494C-ACAB-524FDE069978}_is1'");
  lines.push(')');
  lines.push('');
  lines.push('$found = $false');
  lines.push('foreach ($key in $uninstallKeys) {');
  lines.push('    if (Test-Path $key) {');
  lines.push("        $uninstallString = (Get-ItemProperty $key).UninstallString");
  lines.push('        if ($uninstallString) {');
  lines.push("            $uninstallExe = $uninstallString -replace '\"', ''");
  lines.push('            Write-Host "Running uninstaller: $uninstallExe"');
  lines.push("            Start-Process -FilePath $uninstallExe -ArgumentList '/VERYSILENT','/NORESTART','/SUPPRESSMSGBOXES' -Wait");
  lines.push('            $found = $true');
  lines.push('            break');
  lines.push('        }');
  lines.push('    }');
  lines.push('}');
  lines.push('');
  lines.push('if (-not $found) {');
  lines.push('    Write-Host "VS Code uninstall key not found — may already be removed."');
  lines.push('}');
  lines.push('');
  lines.push('# Clean up scaffolding we dropped during install (Default profile seeding).');
  lines.push('# Leave per-user extensions and per-user settings.json alone — those belong');
  lines.push('# to the user, consistent with the Decision 9 user-wins stance.');
  lines.push("$defaultArtifacts = @(");
  lines.push("    'C:\\Users\\Default\\AppData\\Roaming\\Code\\User\\settings.json',");
  lines.push("    'C:\\Users\\Default\\.vscode\\extensions\\.baseline-pending.txt'");
  lines.push(')');
  lines.push('foreach ($path in $defaultArtifacts) {');
  lines.push('    if (Test-Path $path) {');
  lines.push('        Remove-Item $path -Force -ErrorAction SilentlyContinue');
  lines.push('        Write-Host "Removed $path"');
  lines.push('    }');
  lines.push('}');
  lines.push('');
  lines.push('exit 0');

  return lines.join('\n') + '\n';

  // baseline param kept on the signature for symmetry; not currently read here
  // because uninstall paths are stable across baselines. If future scaffolding
  // varies per-baseline (e.g. baseline-name in registry), use it then.
  void baseline;
}
