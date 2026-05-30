/**
 * Top-level generator — converts a Baseline into the complete bundle of files
 * an admin needs to deploy. The UI calls `generateBundle()` once and gets back
 * everything: scripts, detection rules, baseline JSON, README.
 */

import type { Baseline } from '../lib/baseline-schema';

import { generateWindowsInstallScript } from './windows-install';
import { generateWindowsUserScript } from './windows-user';
import { generateWindowsDetectionScript } from './windows-detection';
import { generateWindowsUninstallScript } from './windows-uninstall';
import {
  generateWindowsRemediationDetection,
  generateWindowsRemediationApply
} from './windows-remediation';

import { generateMacOSInstallScript } from './macos-install';
import { generateMacOSUserScript } from './macos-user';
import { generateMacOSUninstallScript } from './macos-uninstall';

import { generatePlainPowerShellScript } from './plain-powershell';
import { generateBundleReadme } from './readme';

export interface BundleFile {
  /** Relative path inside the bundle. */
  path: string;
  /** File contents — plain text. */
  content: string;
  /** What this file is for, in one sentence. Shown in the UI tab strip. */
  label: string;
  /** Language hint for syntax/preview styling. */
  language: 'powershell' | 'bash' | 'json' | 'markdown';
}

/** Full bundle of files for the selected platforms. */
export function generateBundle(baseline: Baseline): BundleFile[] {
  const files: BundleFile[] = [];

  if (baseline.platforms.includes('windows')) {
    files.push({
      path: 'windows/install-system.ps1',
      label: 'Windows · install (SYSTEM)',
      language: 'powershell',
      content: generateWindowsInstallScript(baseline)
    });
    files.push({
      path: 'windows/configure-user.ps1',
      label: 'Windows · configure (USER)',
      language: 'powershell',
      content: generateWindowsUserScript(baseline)
    });
    files.push({
      path: 'windows/detect-installed.ps1',
      label: 'Windows · detection',
      language: 'powershell',
      content: generateWindowsDetectionScript(baseline)
    });
    files.push({
      path: 'windows/uninstall.ps1',
      label: 'Windows · uninstall',
      language: 'powershell',
      content: generateWindowsUninstallScript(baseline)
    });
    files.push({
      path: 'windows/detect-baseline.ps1',
      label: 'Windows · ProActive Remediation (detect)',
      language: 'powershell',
      content: generateWindowsRemediationDetection(baseline)
    });
    files.push({
      path: 'windows/apply-baseline.ps1',
      label: 'Windows · ProActive Remediation (apply)',
      language: 'powershell',
      content: generateWindowsRemediationApply(baseline)
    });
  }

  if (baseline.platforms.includes('macos')) {
    files.push({
      path: 'macos/install-system.sh',
      label: 'macOS · install (SYSTEM)',
      language: 'bash',
      content: generateMacOSInstallScript(baseline)
    });
    files.push({
      path: 'macos/configure-user.sh',
      label: 'macOS · configure (USER)',
      language: 'bash',
      content: generateMacOSUserScript(baseline)
    });
    files.push({
      path: 'macos/uninstall.sh',
      label: 'macOS · uninstall',
      language: 'bash',
      content: generateMacOSUninstallScript(baseline)
    });
  }

  files.push({
    path: 'plain/vscode-baseline.ps1',
    label: 'Plain PowerShell (non-Intune)',
    language: 'powershell',
    content: generatePlainPowerShellScript(baseline)
  });

  files.push({
    path: 'baseline.json',
    label: 'baseline.json',
    language: 'json',
    content: JSON.stringify(baseline, null, 2) + '\n'
  });

  files.push({
    path: 'README.md',
    label: 'README',
    language: 'markdown',
    content: generateBundleReadme(baseline)
  });

  return files;
}
