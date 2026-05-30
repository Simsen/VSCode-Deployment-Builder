/**
 * macOS SYSTEM-context install script — install-system.sh.
 *
 * Deployed via Intune's macOS shell script channel in SYSTEM context.
 * Downloads the VS Code pkg, installs to /Applications, creates the `code`
 * CLI symlink (which VS Code does NOT auto-create on macOS), drops a
 * LaunchAgent plist that bootstraps each user on login.
 *
 * Two macOS-specific landmines worth knowing (and documented in the script):
 *   1. /usr/local/bin/code shim must be created manually — VS Code normally
 *      creates it only when the user runs the Command Palette action.
 *   2. LaunchAgent runs at login but extension installs need network; the
 *      bootstrap waits for connectivity before running `code --install-extension`.
 */

import type { Baseline } from '../lib/baseline-schema';
import {
  resolveExtensionInstallList,
  resolveSettingsOverlay,
  scriptBanner,
  vscodeDownloadUrl
} from './shared';

const LAUNCH_AGENT_LABEL = 'dk.simsenblog.vscode-baseline';
const BOOTSTRAP_DIR = '/Library/Application Support/vscode-baseline';
const BOOTSTRAP_PATH = `${BOOTSTRAP_DIR}/bootstrap.sh`;
const LAUNCH_AGENT_PATH = `/Library/LaunchAgents/${LAUNCH_AGENT_LABEL}.plist`;

export function generateMacOSInstallScript(baseline: Baseline): string {
  const downloadUrl = vscodeDownloadUrl(baseline, 'darwin');
  const extensions = resolveExtensionInstallList(baseline);
  const settings = resolveSettingsOverlay(baseline);

  const settingsJson = JSON.stringify(settings, null, 2);
  const extensionsList = extensions.join('\n');

  const bootstrapScript = buildBootstrapScript();
  const launchAgentPlist = buildLaunchAgentPlist();

  const lines: string[] = [];
  lines.push('#!/bin/bash');
  lines.push(scriptBanner(baseline, 'macOS install-system.sh — SYSTEM context, Intune macOS shell script'));
  lines.push('');
  lines.push('set -euo pipefail');
  lines.push('');
  lines.push('# 1. Download and install VS Code.');
  lines.push(`VSCODE_URL="${downloadUrl}"`);
  lines.push('PKG_PATH="/tmp/vscode-installer.pkg"');
  lines.push('echo "Downloading VS Code from $VSCODE_URL"');
  lines.push('curl -L --fail -o "$PKG_PATH" "$VSCODE_URL"');
  lines.push('echo "Installing pkg..."');
  lines.push('installer -pkg "$PKG_PATH" -target /');
  lines.push('rm -f "$PKG_PATH"');
  lines.push('');
  lines.push('# 2. Create the `code` CLI shim. VS Code does NOT create this');
  lines.push('#    automatically on macOS — normally the user has to run');
  lines.push('#    "Shell Command: Install \'code\' command in PATH" from the Command');
  lines.push('#    Palette. Skipping this step makes per-user extension installs fail');
  lines.push('#    silently.');
  lines.push('CODE_TARGET="/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"');
  lines.push('if [[ -f "$CODE_TARGET" ]]; then');
  lines.push('    ln -sf "$CODE_TARGET" /usr/local/bin/code');
  lines.push('    echo "Created /usr/local/bin/code symlink"');
  lines.push('fi');
  lines.push('');
  lines.push('# 3. Drop the bootstrap script + LaunchAgent that handles per-user setup.');
  lines.push(`mkdir -p "${BOOTSTRAP_DIR}"`);
  lines.push('');
  lines.push(`cat > "${BOOTSTRAP_DIR}/baseline-settings.json" << 'BASELINE_SETTINGS_EOF'`);
  lines.push(settingsJson);
  lines.push('BASELINE_SETTINGS_EOF');
  lines.push('');
  lines.push(`cat > "${BOOTSTRAP_DIR}/baseline-extensions.txt" << 'BASELINE_EXT_EOF'`);
  lines.push(extensionsList);
  lines.push('BASELINE_EXT_EOF');
  lines.push('');
  lines.push(`cat > "${BOOTSTRAP_PATH}" << 'BOOTSTRAP_EOF'`);
  lines.push(bootstrapScript);
  lines.push('BOOTSTRAP_EOF');
  lines.push(`chmod 755 "${BOOTSTRAP_PATH}"`);
  lines.push('');
  lines.push(`cat > "${LAUNCH_AGENT_PATH}" << 'LAUNCH_AGENT_EOF'`);
  lines.push(launchAgentPlist);
  lines.push('LAUNCH_AGENT_EOF');
  lines.push(`chown root:wheel "${LAUNCH_AGENT_PATH}"`);
  lines.push(`chmod 644 "${LAUNCH_AGENT_PATH}"`);
  lines.push('');
  lines.push('# Load the LaunchAgent for any currently-logged-in users. New logins pick');
  lines.push('# it up automatically.');
  lines.push('current_user=$(stat -f "%Su" /dev/console 2>/dev/null || true)');
  lines.push('if [[ -n "$current_user" && "$current_user" != "root" ]]; then');
  lines.push('    uid=$(id -u "$current_user")');
  lines.push(`    launchctl bootstrap "gui/$uid" "${LAUNCH_AGENT_PATH}" 2>/dev/null || true`);
  lines.push('fi');
  lines.push('');
  lines.push('echo "VS Code system install complete."');
  lines.push('exit 0');

  return lines.join('\n') + '\n';
}

/**
 * The per-user bootstrap script the LaunchAgent invokes. Runs as the user;
 * idempotent via a sentinel file in their home; waits for network before
 * touching extensions.
 */
function buildBootstrapScript(): string {
  return `#!/bin/bash
# Per-user VS Code baseline bootstrap. Invoked by the LaunchAgent at login.
# Idempotent via the sentinel file — subsequent logins do nothing unless the
# admin bumps the LaunchAgent label or removes the sentinel.

set -euo pipefail

SENTINEL="$HOME/Library/Application Support/Code/.baseline-bootstrap-done"
SETTINGS_PATH="$HOME/Library/Application Support/Code/User/settings.json"
SIDECAR_PATH="$HOME/Library/Application Support/Code/User/.baseline-managed-keys.json"
BASELINE_DIR="${BOOTSTRAP_DIR}"

# Quick exit if we've already done this user.
if [[ -f "$SENTINEL" ]]; then
    exit 0
fi

# Wait for VS Code's \`code\` CLI to be on PATH.
for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
    if command -v code >/dev/null 2>&1; then break; fi
    sleep 5
done
if ! command -v code >/dev/null 2>&1; then
    # Couldn't find code after a minute. Bail silently so we retry on next login.
    exit 0
fi

# Wait for network — the marketplace API needs to be reachable for installs.
for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
    if curl -sf --max-time 5 https://marketplace.visualstudio.com >/dev/null 2>&1; then break; fi
    sleep 5
done

# Install extensions.
if [[ -f "$BASELINE_DIR/baseline-extensions.txt" ]]; then
    while IFS= read -r ext; do
        [[ -z "$ext" ]] && continue
        echo "Installing extension: $ext"
        code --install-extension "$ext" --force >/dev/null 2>&1 || true
    done < "$BASELINE_DIR/baseline-extensions.txt"
fi

# Write settings.json — v1 overwrite for the LaunchAgent path. The full
# user-wins merge logic lives in configure-user.sh for the manual / Intune
# user-script channel. The LaunchAgent fires at first login for new users
# (where there's nothing to merge with), so overwrite is correct there.
mkdir -p "$(dirname "$SETTINGS_PATH")"
if [[ -f "$BASELINE_DIR/baseline-settings.json" ]]; then
    cp "$BASELINE_DIR/baseline-settings.json" "$SETTINGS_PATH"
fi

# Record managed keys so configure-user.sh can do real merges later.
if command -v python3 >/dev/null 2>&1; then
    python3 -c "import json,sys; d=json.load(open('$BASELINE_DIR/baseline-settings.json')); open('$SIDECAR_PATH','w').write(json.dumps(sorted(d.keys())))"
fi

touch "$SENTINEL"
echo "Baseline bootstrap complete for $USER"
exit 0
`;
}

/** The LaunchAgent plist that fires the bootstrap once per user at login. */
function buildLaunchAgentPlist(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${LAUNCH_AGENT_LABEL}</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>${BOOTSTRAP_PATH}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/vscode-baseline.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/vscode-baseline.err</string>
</dict>
</plist>`;
}
