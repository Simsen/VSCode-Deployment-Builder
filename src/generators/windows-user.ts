/**
 * Windows USER-context configure script — configure-user.ps1.
 *
 * Deployed via Intune PowerShell Script with user assignment (one-shot
 * channel) per Decision 14b. Runs in the logged-in user's context, installs
 * baseline extensions, merges settings.json with user-wins semantics, persists
 * a managed-keys sidecar for future drift detection.
 *
 * Idempotent — re-running is safe and is how baseline updates propagate when
 * the admin bumps the script version in Intune.
 */

import type { Baseline } from '../lib/baseline-schema';
import {
  resolveExtensionInstallList,
  resolveSettingsOverlay,
  scriptBanner
} from './shared';

export function generateWindowsUserScript(baseline: Baseline): string {
  const extensions = resolveExtensionInstallList(baseline);
  const settings = resolveSettingsOverlay(baseline);

  const settingsJsonLiteral = JSON.stringify(settings, null, 2);
  const extensionsJsonLiteral = JSON.stringify(extensions, null, 2);

  const lines: string[] = [];
  lines.push(scriptBanner(baseline, 'Windows configure-user.ps1 — USER context, Intune PowerShell Script'));
  lines.push('');
  lines.push("$ErrorActionPreference = 'Stop'");
  lines.push('');
  lines.push('# ─── Wait for the `code` CLI to be available ─────────────────────────');
  lines.push('# Intune may run this before VS Code\'s installer has finished propagating');
  lines.push('# PATH changes. Poll for up to 60 seconds; exit cleanly if not found.');
  lines.push('$codeCmd = $null');
  lines.push('for ($i = 0; $i -lt 12; $i++) {');
  lines.push("    $codeCmd = Get-Command code -ErrorAction SilentlyContinue");
  lines.push('    if ($codeCmd) { break }');
  lines.push('    Start-Sleep -Seconds 5');
  lines.push('}');
  lines.push('if (-not $codeCmd) {');
  lines.push('    Write-Host "VS Code `code` CLI not found after 60s — skipping baseline apply."');
  lines.push('    exit 0');
  lines.push('}');
  lines.push('');
  lines.push('# ─── Install / update baseline extensions ────────────────────────────');
  lines.push("$extensions = @'");
  lines.push(extensionsJsonLiteral);
  lines.push("'@ | ConvertFrom-Json");
  lines.push('');
  lines.push('foreach ($ext in $extensions) {');
  lines.push('    Write-Host "Installing extension: $ext"');
  lines.push('    & code --install-extension $ext --force 2>&1 | Out-Null');
  lines.push('}');
  lines.push('');
  lines.push('# ─── Merge settings.json (user-wins) ─────────────────────────────────');
  lines.push('# Decision 9: baseline keys are *defaults*. User customizations always survive.');
  lines.push('# A sidecar tracks which keys we manage so future runs can tell our defaults');
  lines.push('# apart from the user\'s overrides. JSONC comments in settings.json are LOST');
  lines.push('# in v1 (documented limitation, fix candidate for v1.1).');
  lines.push('');
  lines.push('$settingsPath = Join-Path $env:APPDATA "Code\\User\\settings.json"');
  lines.push('$sidecarPath  = Join-Path $env:APPDATA "Code\\User\\.baseline-managed-keys.json"');
  lines.push('New-Item -Path (Split-Path $settingsPath) -ItemType Directory -Force | Out-Null');
  lines.push('');
  lines.push("$baselineJson = @'");
  lines.push(settingsJsonLiteral);
  lines.push("'@");
  lines.push('$baseline = $baselineJson | ConvertFrom-Json -AsHashtable');
  lines.push('');
  lines.push('# Load existing settings.json — accept JSONC comments and trailing commas');
  lines.push('$existing = @{}');
  lines.push('if (Test-Path $settingsPath) {');
  lines.push('    $raw = Get-Content $settingsPath -Raw -ErrorAction SilentlyContinue');
  lines.push('    if ($raw) {');
  lines.push("        $stripped = $raw -replace '(?ms)/\\*.*?\\*/', '' -replace '(?m)//.*$', ''");
  lines.push("        $stripped = $stripped -replace ',(\\s*[}\\]])', '$1'");
  lines.push('        try { $existing = $stripped | ConvertFrom-Json -AsHashtable } catch { $existing = @{} }');
  lines.push('    }');
  lines.push('}');
  lines.push('if ($null -eq $existing) { $existing = @{} }');
  lines.push('');
  lines.push('$priorManaged = @()');
  lines.push('if (Test-Path $sidecarPath) {');
  lines.push('    try { $priorManaged = (Get-Content $sidecarPath -Raw | ConvertFrom-Json) } catch { $priorManaged = @() }');
  lines.push('}');
  lines.push('$managedSet = [System.Collections.Generic.HashSet[string]]::new()');
  lines.push('foreach ($k in $priorManaged) { [void]$managedSet.Add($k) }');
  lines.push('');
  lines.push('$merged = @{}');
  lines.push('foreach ($k in $existing.Keys) { $merged[$k] = $existing[$k] }');
  lines.push('');
  lines.push('foreach ($key in $baseline.Keys) {');
  lines.push('    $userHas = $existing.ContainsKey($key)');
  lines.push('    if (-not $userHas) {');
  lines.push('        # User hasn\'t set this — apply baseline default');
  lines.push('        $merged[$key] = $baseline[$key]');
  lines.push('        [void]$managedSet.Add($key)');
  lines.push('    } else {');
  lines.push('        # User has a value. Refresh only if they haven\'t diverged from the baseline.');
  lines.push('        $userVal = ($existing[$key] | ConvertTo-Json -Compress -Depth 10)');
  lines.push('        $baseVal = ($baseline[$key] | ConvertTo-Json -Compress -Depth 10)');
  lines.push('        if ($managedSet.Contains($key) -and ($userVal -eq $baseVal)) {');
  lines.push('            $merged[$key] = $baseline[$key]');
  lines.push('        }');
  lines.push('        [void]$managedSet.Add($key)');
  lines.push('    }');
  lines.push('}');
  lines.push('');
  lines.push('$mergedJson = $merged | ConvertTo-Json -Depth 10');
  lines.push('Set-Content -Path $settingsPath -Value $mergedJson -Encoding UTF8');
  lines.push('');
  lines.push('$managedJson = ($managedSet | Sort-Object) | ConvertTo-Json -Compress');
  lines.push('Set-Content -Path $sidecarPath -Value $managedJson -Encoding UTF8');
  lines.push('');
  lines.push('Write-Host "Baseline applied. Extensions: $($extensions.Count). Managed keys: $($managedSet.Count)."');
  lines.push('');

  if (baseline.copilot.enabled) {
    lines.push('# ─── Copilot ─────────────────────────────────────────────────────────');
    lines.push('# Copilot extension installed above. The user will see a sign-in prompt');
    lines.push('# on first launch — auth flows cannot be scripted (Decision 12). Make sure');
    lines.push('# the user has a Copilot license assigned in your Azure tenant before they');
    lines.push('# attempt sign-in, otherwise they\'ll bounce off an unhelpful error.');
    lines.push('');
  }

  lines.push('exit 0');

  return lines.join('\n') + '\n';
}
