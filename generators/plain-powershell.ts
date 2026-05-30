/**
 * Plain PowerShell output — vscode-baseline.ps1.
 *
 * Single-script interactive install for non-Intune use. The "give this to a
 * developer / run it yourself" path. Uses winget when available (friendly for
 * interactive use), falls back to bootstrapper download.
 *
 * Per Decision 6 the per-user/per-machine toggle is exposed for this output
 * only — Intune outputs are always per-machine.
 */

import type { Baseline } from '../lib/baseline-schema';
import {
  resolveExtensionInstallList,
  resolveSettingsOverlay,
  scriptBanner
} from './shared';

export function generatePlainPowerShellScript(baseline: Baseline): string {
  const extensions = resolveExtensionInstallList(baseline);
  const settings = resolveSettingsOverlay(baseline);

  const wingetId = baseline.scope === 'user' ? 'Microsoft.VisualStudioCode' : 'Microsoft.VisualStudioCode';
  const wingetScope = baseline.scope === 'user' ? 'user' : 'machine';
  const versionArg = baseline.pinning.vscode && baseline.pinning.vscodeVersion
    ? ` --version ${baseline.pinning.vscodeVersion}`
    : '';

  const settingsJsonLiteral = JSON.stringify(settings, null, 2);
  const extensionsJsonLiteral = JSON.stringify(extensions, null, 2);

  const lines: string[] = [];
  lines.push(scriptBanner(baseline, 'Plain PowerShell — interactive install + configure'));
  lines.push('');
  lines.push('# Use this when you want to give someone a single script to run');
  lines.push('# themselves (or run it interactively yourself). For managed-fleet');
  lines.push('# deployment via Intune, use the install-system.ps1 + configure-user.ps1');
  lines.push('# pair from the same bundle instead.');
  lines.push('');
  lines.push("$ErrorActionPreference = 'Stop'");
  lines.push('');
  lines.push('# 1. Install VS Code via winget if available, else fall back to the bootstrapper.');
  lines.push('$winget = Get-Command winget -ErrorAction SilentlyContinue');
  lines.push('if ($winget) {');
  lines.push(`    Write-Host "Installing VS Code via winget (scope: ${wingetScope})..."`);
  lines.push(`    & winget install --id ${wingetId} --scope ${wingetScope} --silent --accept-package-agreements --accept-source-agreements${versionArg}`);
  lines.push('} else {');
  lines.push('    Write-Host "winget not available — downloading bootstrapper directly."');
  lines.push("    $url = 'https://update.code.visualstudio.com/latest/win32-x64" + (baseline.scope === 'user' ? '-user' : '') + "/stable'");
  lines.push("    $tmp = Join-Path $env:TEMP 'VSCodeSetup.exe'");
  lines.push('    Invoke-WebRequest -Uri $url -OutFile $tmp -UseBasicParsing');
  lines.push("    Start-Process -FilePath $tmp -ArgumentList '/VERYSILENT','/NORESTART','/MERGETASKS=addtopath,!runcode' -Wait");
  lines.push('    Remove-Item $tmp -Force');
  lines.push('}');
  lines.push('');
  lines.push('# 2. Wait for `code` to become available on PATH.');
  lines.push('for ($i = 0; $i -lt 12; $i++) {');
  lines.push('    if (Get-Command code -ErrorAction SilentlyContinue) { break }');
  lines.push('    Start-Sleep -Seconds 5');
  lines.push('}');
  lines.push('if (-not (Get-Command code -ErrorAction SilentlyContinue)) {');
  lines.push('    Write-Host "VS Code installed but `code` not on PATH yet — open a new shell and re-run the extension step."');
  lines.push('    exit 0');
  lines.push('}');
  lines.push('');
  lines.push('# 3. Install baseline extensions.');
  lines.push("$extensions = @'");
  lines.push(extensionsJsonLiteral);
  lines.push("'@ | ConvertFrom-Json");
  lines.push('foreach ($ext in $extensions) {');
  lines.push('    Write-Host "Installing extension: $ext"');
  lines.push('    & code --install-extension $ext --force 2>&1 | Out-Null');
  lines.push('}');
  lines.push('');
  lines.push('# 4. Write baseline settings.json (overwrite — this is the simple path).');
  lines.push('#    If you want merge-with-user-customizations, use configure-user.ps1 instead.');
  lines.push('$settingsPath = Join-Path $env:APPDATA "Code\\User\\settings.json"');
  lines.push('New-Item -Path (Split-Path $settingsPath) -ItemType Directory -Force | Out-Null');
  lines.push("$baselineJson = @'");
  lines.push(settingsJsonLiteral);
  lines.push("'@");
  lines.push('Set-Content -Path $settingsPath -Value $baselineJson -Encoding UTF8');
  lines.push('');
  lines.push('Write-Host "Done. Open VS Code to start using the baseline."');

  if (baseline.copilot.enabled) {
    lines.push('Write-Host "Note: Copilot was installed — sign in via VS Code on first launch."');
  }

  return lines.join('\n') + '\n';
}
