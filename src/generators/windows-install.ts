/**
 * Windows SYSTEM-context install script — install-system.ps1.
 *
 * Deployed via Intune Win32 app, SYSTEM context. Installs VS Code per-machine
 * using the official bootstrapper, with /VERYSILENT and the user's chosen
 * /MERGETASKS. Optionally seeds the Default user profile so users created
 * after deployment get the baseline on first login.
 *
 * This script does NOT install extensions or apply user settings — that work
 * lives in configure-user.ps1 (user-context Intune script), per Decision 14.
 */

import type { Baseline } from '../lib/baseline-schema';
import {
  computeMergeTasksString,
  resolveExtensionInstallList,
  resolveSettingsOverlay,
  scriptBanner,
  toJsonLiteral,
  vscodeDownloadUrl
} from './shared';

export function generateWindowsInstallScript(baseline: Baseline): string {
  const mergetasks = computeMergeTasksString(baseline.mergetasks);
  const downloadUrl = vscodeDownloadUrl(baseline, 'win32-x64');
  const seedDefault = baseline.scope === 'machine';
  const extensions = resolveExtensionInstallList(baseline);
  const settings = resolveSettingsOverlay(baseline);

  const settingsJson = JSON.stringify(settings, null, 2);

  const lines: string[] = [];
  lines.push(scriptBanner(baseline, 'Windows install-system.ps1 — SYSTEM context, Intune Win32'));
  lines.push('');
  lines.push('#Requires -RunAsAdministrator');
  lines.push("$ErrorActionPreference = 'Stop'");
  lines.push('');
  lines.push('# 1. Download the official VS Code bootstrapper.');
  lines.push(`$installerUrl = '${downloadUrl}'`);
  lines.push("$tempInstaller = Join-Path $env:TEMP 'VSCodeSetup.exe'");
  lines.push('Write-Host "Downloading VS Code from $installerUrl"');
  lines.push('Invoke-WebRequest -Uri $installerUrl -OutFile $tempInstaller -UseBasicParsing');
  lines.push('');
  lines.push('# 2. Run unattended install. /MERGETASKS lines up with the baseline UI choices.');
  lines.push(`$mergeTasks = '${mergetasks}'`);
  lines.push('$installArgs = @(');
  lines.push("    '/VERYSILENT',");
  lines.push("    '/NORESTART',");
  lines.push("    '/SUPPRESSMSGBOXES',");
  lines.push('    "/MERGETASKS=$mergeTasks"');
  lines.push(')');
  lines.push('Write-Host "Installing VS Code (machine scope) with tasks: $mergeTasks"');
  lines.push('$proc = Start-Process -FilePath $tempInstaller -ArgumentList $installArgs -Wait -PassThru');
  lines.push('if ($proc.ExitCode -ne 0) {');
  lines.push('    throw "VS Code installer exited with code $($proc.ExitCode)"');
  lines.push('}');
  lines.push('Remove-Item $tempInstaller -Force -ErrorAction SilentlyContinue');

  if (seedDefault) {
    lines.push('');
    lines.push('# 3. Seed the Default user profile with the baseline settings.json so users');
    lines.push('#    created AFTER this point get the baseline on first login. Existing users');
    lines.push('#    get the baseline via the separate configure-user.ps1 (Intune user-context).');
    lines.push("$defaultUserSettings = 'C:\\Users\\Default\\AppData\\Roaming\\Code\\User\\settings.json'");
    lines.push('$defaultUserSettingsDir = Split-Path $defaultUserSettings -Parent');
    lines.push('New-Item -Path $defaultUserSettingsDir -ItemType Directory -Force | Out-Null');
    lines.push('$baselineSettingsJson = @\'');
    lines.push(settingsJson);
    lines.push("'@");
    lines.push('Set-Content -Path $defaultUserSettings -Value $baselineSettingsJson -Encoding UTF8');
    lines.push('Write-Host "Seeded Default profile settings.json"');

    if (extensions.length > 0) {
      lines.push('');
      lines.push('# Pre-populate extension stubs in the Default profile. Real install happens');
      lines.push('# per-user from configure-user.ps1 (extension files live under each user).');
      lines.push("$defaultExtList = 'C:\\Users\\Default\\.vscode\\extensions\\.baseline-pending.txt'");
      lines.push('New-Item -Path (Split-Path $defaultExtList -Parent) -ItemType Directory -Force | Out-Null');
      lines.push(`$pending = @'`);
      lines.push(extensions.join('\n'));
      lines.push("'@");
      lines.push('Set-Content -Path $defaultExtList -Value $pending -Encoding UTF8');
    }
  }

  lines.push('');
  lines.push('Write-Host "VS Code system install complete."');
  lines.push('exit 0');

  // Drop in a short note about how the bundle fits together. Embedded as a
  // PowerShell comment so the admin reading the script understands the model.
  lines.push('');
  lines.push('# Bundle context:');
  lines.push('#   - This script handles the machine install only (Intune Win32, SYSTEM).');
  lines.push('#   - configure-user.ps1 handles per-user extensions + settings');
  lines.push('#     (Intune PowerShell Script, assigned to user groups).');
  lines.push('#   - apply-baseline.ps1 + detect-baseline.ps1 are the same logic packaged');
  lines.push('#     for Proactive Remediations if you have Endpoint Analytics licensing.');
  lines.push('#   - detect-installed.ps1 is the Win32 app detection rule for THIS script.');
  lines.push('#   - uninstall.ps1 removes VS Code + the seeded Default profile artifacts.');
  lines.push('#   - baseline.json captures the full baseline this bundle was generated from.');

  // Final newline keeps editors happy and avoids "no newline at end of file" diffs.
  return lines.join('\n') + '\n';

  // (toJsonLiteral is imported above for symmetry with other generators that need it.)
  void toJsonLiteral;
}
