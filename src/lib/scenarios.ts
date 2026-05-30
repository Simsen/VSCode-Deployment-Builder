/**
 * Deployment scenarios — the answer to "when do I use which file?"
 *
 * The bundle contains every file an admin might need; scenarios filter that
 * down to a recipe for one specific deployment approach. Each scenario lists
 * its files IN ORDER, with a one-line note on how to wire it up in Intune.
 *
 * The UI surfaces scenarios as tabs above the file rail. Selecting a scenario
 * shows just its files (numbered as steps); reference files (baseline.json,
 * README) stay visible regardless.
 */

import type { Platform } from './baseline-schema';

export interface ScenarioStep {
  /** Path inside the generated bundle (matches BundleFile.path). */
  filePath: string;
  /** Short instruction shown under the filename in the rail. */
  deployAs: string;
}

export interface Scenario {
  id: string;
  label: string;
  /** Which platform this scenario belongs to — gates visibility. */
  platform: Platform;
  /** One-paragraph context: when is this the right scenario? */
  description: string;
  /** Optional small caveat shown under the description (e.g. licensing). */
  caveat?: string;
  /** Files for this scenario, in deployment order. */
  steps: ScenarioStep[];
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'win-user-script',
    label: 'Windows · Intune (PS Script for users)',
    platform: 'windows',
    description:
      'One-shot per-user deployment. Push the Win32 app for the machine install; push the user-context PowerShell Script for extensions and settings. Each user picks up the baseline the first time the script runs against their account.',
    steps: [
      { filePath: 'windows/install-system.ps1', deployAs: 'Win32 app · install (SYSTEM)' },
      { filePath: 'windows/detect-installed.ps1', deployAs: 'Win32 detection rule' },
      { filePath: 'windows/uninstall.ps1', deployAs: 'Win32 uninstall' },
      { filePath: 'windows/configure-user.ps1', deployAs: 'PowerShell Script · user assignment' }
    ]
  },
  {
    id: 'win-remediation',
    label: 'Windows · Intune (Proactive Remediation)',
    platform: 'windows',
    description:
      'For ongoing drift detection. Win32 app installs VS Code; the Proactive Remediation pair checks each user\'s settings.json and re-applies the baseline if it has drifted. Runs on a schedule, so baseline updates propagate without re-deploying.',
    caveat: 'Requires Endpoint Analytics — included in M365 E3/E5/F3 and Intune P1.',
    steps: [
      { filePath: 'windows/install-system.ps1', deployAs: 'Win32 app · install (SYSTEM)' },
      { filePath: 'windows/detect-installed.ps1', deployAs: 'Win32 detection rule' },
      { filePath: 'windows/uninstall.ps1', deployAs: 'Win32 uninstall' },
      { filePath: 'windows/detect-baseline.ps1', deployAs: 'Proactive Remediation · detection' },
      { filePath: 'windows/apply-baseline.ps1', deployAs: 'Proactive Remediation · remediation' }
    ]
  },
  {
    id: 'win-standalone',
    label: 'Windows · Standalone (no Intune)',
    platform: 'windows',
    description:
      'A single interactive PowerShell script. Hand it to a developer to run on their own machine. Installs VS Code via winget (or falls back to the bootstrapper), installs extensions, writes settings.json. Not idempotent in the user-wins sense — for that, use the user-script scenario.',
    steps: [
      { filePath: 'plain/vscode-baseline.ps1', deployAs: 'Run interactively as the user' }
    ]
  },
  {
    id: 'mac-intune',
    label: 'macOS · Intune',
    platform: 'macos',
    description:
      'The SYSTEM-context shell script installs VS Code and drops a LaunchAgent that handles per-user setup automatically on first login. configure-user.sh is optional — push it via the user-context shell script channel for users who logged in before deployment ran.',
    steps: [
      { filePath: 'macos/install-system.sh', deployAs: 'Shell script · SYSTEM context' },
      { filePath: 'macos/uninstall.sh', deployAs: 'Uninstall script' },
      { filePath: 'macos/configure-user.sh', deployAs: 'Optional: user-context refresh' }
    ]
  }
];

/** The files that should appear in the always-visible "Reference" group. */
export const REFERENCE_PATHS = ['baseline.json', 'README.md'];
