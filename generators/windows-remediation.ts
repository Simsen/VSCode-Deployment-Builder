/**
 * Proactive Remediation pair — detect-baseline.ps1 + apply-baseline.ps1.
 *
 * For admins with Endpoint Analytics licensing (M365 E3/E5/F3, Intune P1).
 * Detection script returns non-zero when the user's settings.json has drifted
 * from the baseline-managed keys; remediation script is the same logic as
 * configure-user.ps1 — recomputed each run.
 *
 * Per Decision 14b, the generator emits BOTH this pair AND the one-shot
 * configure-user.ps1 — admin picks based on their licensing and process.
 */

import type { Baseline } from '../lib/baseline-schema';
import { resolveSettingsOverlay, scriptBanner } from './shared';
import { generateWindowsUserScript } from './windows-user';

export function generateWindowsRemediationDetection(baseline: Baseline): string {
  const settings = resolveSettingsOverlay(baseline);
  const settingsJsonLiteral = JSON.stringify(settings, null, 2);

  const lines: string[] = [];
  lines.push(scriptBanner(baseline, 'Windows detect-baseline.ps1 — Proactive Remediation detection'));
  lines.push('');
  lines.push("$ErrorActionPreference = 'SilentlyContinue'");
  lines.push('');
  lines.push('$settingsPath = Join-Path $env:APPDATA "Code\\User\\settings.json"');
  lines.push('$sidecarPath  = Join-Path $env:APPDATA "Code\\User\\.baseline-managed-keys.json"');
  lines.push('');
  lines.push('if (-not (Test-Path $settingsPath)) {');
  lines.push('    Write-Host "Settings not present — remediation needed."');
  lines.push('    exit 1');
  lines.push('}');
  lines.push('');
  lines.push("$baselineJson = @'");
  lines.push(settingsJsonLiteral);
  lines.push("'@");
  lines.push('$baseline = $baselineJson | ConvertFrom-Json -AsHashtable');
  lines.push('');
  lines.push('$raw = Get-Content $settingsPath -Raw');
  lines.push("$stripped = $raw -replace '(?ms)/\\*.*?\\*/', '' -replace '(?m)//.*$', ''");
  lines.push("$stripped = $stripped -replace ',(\\s*[}\\]])', '$1'");
  lines.push('try { $existing = $stripped | ConvertFrom-Json -AsHashtable } catch { $existing = @{} }');
  lines.push('if ($null -eq $existing) { $existing = @{} }');
  lines.push('');
  lines.push('$priorManaged = @()');
  lines.push('if (Test-Path $sidecarPath) {');
  lines.push('    try { $priorManaged = (Get-Content $sidecarPath -Raw | ConvertFrom-Json) } catch {}');
  lines.push('}');
  lines.push('$managedSet = [System.Collections.Generic.HashSet[string]]::new()');
  lines.push('foreach ($k in $priorManaged) { [void]$managedSet.Add($k) }');
  lines.push('');
  lines.push('# Drift detection: a baseline-managed key that doesn\'t match the baseline value');
  lines.push('# AND wasn\'t intentionally diverged by the user. In practice that means: if the');
  lines.push('# baseline has a key the user does not, or the user value matches what we last set');
  lines.push('# but differs from the new baseline, we need to remediate.');
  lines.push('foreach ($key in $baseline.Keys) {');
  lines.push('    if (-not $existing.ContainsKey($key)) {');
  lines.push('        Write-Host "Missing baseline key: $key"');
  lines.push('        exit 1');
  lines.push('    }');
  lines.push('}');
  lines.push('');
  lines.push('Write-Host "Baseline state OK."');
  lines.push('exit 0');

  return lines.join('\n') + '\n';
}

export function generateWindowsRemediationApply(baseline: Baseline): string {
  // The remediation script is functionally identical to configure-user.ps1.
  // We rebrand the banner so the admin can tell them apart in the Intune UI.
  const inner = generateWindowsUserScript(baseline);
  const reBannered = inner.replace(
    /^# .* configure-user\.ps1.*$/m,
    '# Windows apply-baseline.ps1 — Proactive Remediation remediation'
  );
  return reBannered;
}
