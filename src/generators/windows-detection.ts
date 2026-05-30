/**
 * Win32 detection script — detect-installed.ps1.
 *
 * Intune Win32 app detection rule. Echo anything + exit 0 = detected.
 * Exit 1 = not detected (Intune will deploy).
 *
 * Default: checks Code.exe exists in Program Files. When pinning is on,
 * tightens to "exists AND version >= pinned version" so an out-of-date
 * VS Code triggers a redeploy.
 */

import type { Baseline } from '../lib/baseline-schema';
import { scriptBanner } from './shared';

export function generateWindowsDetectionScript(baseline: Baseline): string {
  const pin = baseline.pinning.vscode && baseline.pinning.vscodeVersion
    ? baseline.pinning.vscodeVersion
    : null;

  const lines: string[] = [];
  lines.push(scriptBanner(baseline, 'Windows detect-installed.ps1 — Intune Win32 detection rule'));
  lines.push('');
  lines.push("$codeExe = Join-Path $env:ProgramFiles 'Microsoft VS Code\\Code.exe'");
  lines.push('');
  lines.push('if (-not (Test-Path $codeExe)) {');
  lines.push('    exit 1');
  lines.push('}');

  if (pin) {
    lines.push('');
    lines.push('# Pinning is enabled — require the installed version to match or exceed.');
    lines.push(`$requiredVersion = [version]'${pin}'`);
    lines.push('$installedVersion = [version](Get-Item $codeExe).VersionInfo.ProductVersion');
    lines.push('if ($installedVersion -lt $requiredVersion) {');
    lines.push('    exit 1');
    lines.push('}');
  }

  lines.push('');
  lines.push('Write-Host "VS Code detected at $codeExe"');
  lines.push('exit 0');

  return lines.join('\n') + '\n';
}
