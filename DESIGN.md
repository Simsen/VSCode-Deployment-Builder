# VS Code Baseline Generator — v1 Design

A browser-based tool that lets Intune admins assemble a VS Code baseline (extensions, settings, install options) and generates an end-to-end deployment bundle: Intune Win32 install + user-context configuration scripts + detection + uninstall + baseline JSON. Single HTML file, runs from `file://`, no backend, no runtime network calls.

This document consolidates 15 architecture decisions made via the grill-me interview on 2026-05-21. The original draft (`/Users/simon/Library/CloudStorage/OneDrive-Globeteam/Apps/VSCodeBuilder/VSCode_Builder.md`) remains as the brief; this spec supersedes its open questions and v1 scope suggestion.

---

## v1 scope

In: Windows and macOS, both Intune-grade. Curated extension catalog (~25 entries) plus free-text input plus `code --list-extensions` paste import. Layered UI (Simple default view + Advanced disclosure expanders). Baseline export/import as JSON file and URL hash. Version pinning available but defaulted off. Copilot supported with sensible defaults. Settings.json merge with user-wins semantics. Built with Vite + Svelte, output is a single self-contained HTML file.

Out of v1: Linux (no audience for Intune-managed Linux desktops). VS Code Insiders channel (rare in Intune-managed contexts, doubles test surface). Live marketplace API integration (deferred indefinitely — accepts the manual catalog maintenance cost). Active Setup on Windows (replaced by user-context Intune script, see Decision 4/14).

Effort estimate: ~3-4 weekends for Windows pipeline + ~1-2 weekends for Mac port = ~5 weekends total assuming access to an Intune-enrolled Mac for Mac validation. Ship Windows first if Mac hardware is uncertain.

---

## Architecture overview: the bundle model

A generated baseline produces a deployment bundle, not a single script. Each platform emits multiple coordinated artifacts that the admin deploys via different Intune mechanisms. The README in the bundle explains the deployment flow.

### Windows bundle per baseline

The model decomposes machine-level installation (SYSTEM context) from user-level configuration (user context). This replaces the conventional Active Setup pattern with Intune's own user-context script channel, which is more native to Intune and handles the "user already has VS Code installed" case cleanly.

`install-system.ps1` is the Intune Win32 SYSTEM install. Downloads the VS Code bootstrapper from `update.code.visualstudio.com`, runs Inno Setup with `/VERYSILENT` and the selected `/MERGETASKS`, installs per-machine to `C:\Program Files\Microsoft VS Code\`, optionally seeds the Default user profile (`C:\Users\Default\.vscode\extensions\` and `...\AppData\Roaming\Code\User\settings.json`) for users created after deployment. Does no per-user work.

`configure-user.ps1` is the Intune PowerShell Script assigned to user groups (one-shot delivery channel). Runs in the logged-in user's context. Checks for `code` on PATH, installs each baseline extension via `code --install-extension publisher.id[@version]`, applies the settings.json overlay using jsonc-aware merge with user-wins semantics (see Decision 9), writes a sidecar `baseline-managed-keys.json` so subsequent runs know which keys are ours.

`detect-baseline.ps1` + `apply-baseline.ps1` is the Proactive Remediation pair (recurring delivery channel for ongoing baseline maintenance). Detection script returns non-zero if any baseline-managed key in the user's settings.json doesn't match the baseline; remediation runs the same logic as `configure-user.ps1`. For admins with Endpoint Analytics licensing.

`detect-installed.ps1` is the Win32 detection rule for `install-system.ps1`. File existence at `${env:ProgramFiles}\Microsoft VS Code\Code.exe` plus an optional version match if pinning is enabled.

`uninstall.ps1` removes VS Code itself plus all scaffolding we created (Default-profile seeded files, ProgramData scripts, baseline-managed-keys sidecar). Leaves user-profile extensions and user settings.json intact — those belong to the user, consistent with Decision 9's user-wins stance.

`baseline.json` is the canonical schema (see below).

`README.md` walks the admin through deploying all of the above in Intune. Without this README, admins forget the user script and complain that extensions don't install — it's load-bearing documentation, not an afterthought.

### macOS bundle per baseline

`install-system.sh` is the Intune macOS shell script in SYSTEM context. Downloads the VS Code pkg from `update.code.visualstudio.com`, installs to `/Applications/Visual Studio Code.app`, creates the `code` CLI symlink at `/usr/local/bin/code` (VS Code does not auto-create this on macOS — it normally requires the user to run "Shell Command: Install 'code' command in PATH" interactively), drops a LaunchAgent plist at `/Library/LaunchAgents/dk.simsenblog.vscode-baseline.plist` with `RunAtLoad: true`. The LaunchAgent runs at every user's login, executes a per-user bootstrap that checks `~/Library/Application Support/Code/.baseline-bootstrap-done`, runs the same extension/settings logic as the Windows user script, touches the sentinel.

`configure-user.sh` is the user-context Intune macOS shell script for the "user already has VS Code, just apply baseline" case. Parallel to Windows `configure-user.ps1`.

Detection, uninstall, schema, and README follow the same pattern as Windows.

Two macOS-specific landmines worth documenting in the bundle README. First, the `code` CLI shim does not exist after a fresh install — our `install-system.sh` creates it manually with `ln -sf "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code" /usr/local/bin/code`. Skipping this means the LaunchAgent's `code --install-extension` calls fail silently. Second, LaunchAgents fire at login but `code --install-extension` needs network access — on slow corp networks at login the first install can race. The bootstrap script polls for connectivity (`curl -sf https://marketplace.visualstudio.com/_apis/public/gallery` with a retry loop and a 60-second cap) before proceeding.

### Plain PowerShell output (non-Intune)

For admins who want a one-script installer to run themselves or hand to developers. Single file, does install + configure in one shot, uses winget rather than the bootstrapper because winget is friendlier for interactive use. Per-user scope is exposed as an option for this output only (Intune outputs are always per-machine — see Decision below on scope).

### Raw files output

Just `extensions.txt` (one ID per line, with optional `@version`) and `settings.json`. For manual handling or feeding into other tooling.

---

## Decision log

### 1. Product identity

**Decision:** Both a content piece on simsenblog.dk *and* a serious bookmark-able tool. Same artifact, two entry points (blog embed + stable URL like `simsenblog.dk/tools/vscode-baseline/`).

**Rationale:** The blog lane drives launch traffic and gives a real audience to learn from; the standalone tool lane retains admins who'd otherwise bounce after one use. Architecting for both costs little if you commit early, and avoids the trap of either "blog gimmick nobody uses again" or "real tool with no distribution."

### 2. Platforms in v1

**Decision:** Windows + macOS. Linux out.

**Rationale:** The audience for Intune-managed Linux desktops is vanishingly small. Cutting it removes a third generator path, a third detection script, and a third platform you'd have to test, for users who don't exist in your audience segment. Adding it later is additive if the demand ever appears.

### 3. macOS scope

**Decision:** Intune-grade macOS shell script (SYSTEM-context install + per-user bootstrap via LaunchAgent), not a brew-based developer convenience script.

**Rationale:** Treats Mac as a managed-endpoint deployment target on par with Windows, matching the tool's positioning. Counter-position (developer brew script) would be easier to build but less differentiated from existing tooling and less aligned with the Intune-admin audience.

### 4. Windows bootstrap mechanism (superseded by Decision 14)

**Original decision:** Default-profile seeding + Active Setup, with a per-user bootstrap script that catches existing users on next login.

**Superseded by Decision 14:** Active Setup is dropped. Default-profile seeding is retained as a best-effort optimization for users created after deployment. Existing-user catchup is handled by a separate user-context Intune script (Decision 14's E).

**Rationale for the change:** Active Setup predates Intune and is an enterprise-legacy mechanism. Intune has its own purpose-built user-context script delivery channel; using it is more native, simpler, and handles a use case Active Setup doesn't cleanly serve — users who had VS Code installed before our deployment ever ran.

### 5. macOS per-user bootstrap mechanism

**Decision:** LaunchAgent in `/Library/LaunchAgents/` with `RunAtLoad: true`, sentinel file in user home, no external dependencies.

**Rationale:** Self-contained (one plist, one script), no pre-installed tooling required (rules out Outset despite its quality). Modern macOS has no clean Default-profile equivalent — SIP/SSV restrictions make `/System/Library/User Template/` seeding unreliable — so bootstrap-at-login is the only realistic mechanism.

### 6. UX philosophy

**Decision:** Layered. Opinionated default view shows the choices that matter to most admins; an Advanced disclosure within each section reveals the full knob surface for admins who want fine control.

**Rationale:** Reached after pushback on initial "fully flexible" answer (Q6). Combinatorial test surface of a fully-flexible UI is unmanageable in v1; a fully-opinionated UI risks signaling incompleteness to a knob-loving Intune-admin audience. Layered gives both: casual users get a clean experience, deep users get every knob, the default path is the one that gets tested rigorously.

### 7. Extension catalog source

**Decision:** Hand-curated, hardcoded as JSON inside the HTML. Quarterly manual review cadence. No live marketplace API.

**Rationale:** Accepted maintenance burden in exchange for zero infrastructure, no build pipeline for catalog updates, no proxy server, no runtime network dependency, no CORS workaround. The "Diff view" stretch feature becomes more important as the main discovery mechanism since the curated list won't have install-count signals. The free-text `publisher.id` input becomes load-bearing — it's the escape valve for everything outside the catalog.

### 8. Version pinning

**Decision:** Pinnable, defaulted off. When enabled, generator captures versions into the script and adds `"update.mode": "none"` + `"extensions.autoUpdate": false` to settings.json so the pin is not silently undone by auto-update.

**Rationale:** Always-latest is the right default for most admins; pinning has real use cases (regulated industries, reproducible baselines, validation-before-prod) that the tool must support. Defaulting on would be too opinionated for v1.

### 8b. Extension version pinning mechanism

**Decision:** Manual `@version` syntax in the free-text input. Curated checkboxes never pin (install latest). Admins who want pinned curated extensions remove the checkbox and re-add via free-text with `@version`.

**Rationale:** `code --install-extension publisher.id@1.2.3` syntax is native and documented. No marketplace API needed (consistent with Decision 7). Slightly awkward UX (re-typing curated entries) is acceptable because the people who pin extensions are already mentally in that mode.

### 9. settings.json strategy

**Decision:** Merge with user-wins semantics. Baseline keys are a default layer; user customizations always survive. Subsequent baseline updates add new keys and update keys the user hasn't touched.

**Rationale:** The only option that makes sense in a model where users have a real claim to their settings.json. Overwrite-always wipes customizations on every baseline update (UX disaster). Overwrite-if-missing means baseline updates never reach anyone who's used VS Code (defeats the point). Merge-baseline-wins treats settings.json as org-controlled, which is the wrong mental model — users will work around any tool that constantly fights them.

Implementation cost: a `baseline-managed-keys.json` sidecar file per user that tracks which keys the script has ever set. Without this, the second bootstrap can't distinguish "key user has customized" from "key we no longer manage." This is the difference between a 20-line bootstrap and a 60-line one; worth it.

Accepted limitation: VS Code uses JSONC (JSON with Comments and trailing commas). v1 accepts comment loss on merge — naive parse/stringify destroys comments. Document the limitation, fix in v1.1 if anyone complains.

### 10. Baseline export/import

**Decision:** Both JSON file (canonical, archivable, Git-commitable) and URL hash (frictionless casual sharing, gzip+base64 in the URL fragment). Schema locked in v1.

**Rationale:** The two formats serve different workflows that both matter: file for "this is our org's standard, committed to the repo" use cases, URL hash for "hey try this baseline" Slack/email casual share. Cheap to build together because they share the schema. Building one and adding the other later is wasted work.

### 11. Source structure and build

**Decision:** Multi-file source bundled to a single self-contained HTML via Vite (with `vite-plugin-singlefile`). Framework: Svelte (smallest runtime, cleanest form-binding ergonomics). Output works from `file://` URL — see Decision 15 for the constraint this places on version pinning.

**Rationale:** Realistic v1 codebase is 2200-3000 lines (three platform generators, jsonc merge, baseline schema, extension catalog, reactive UI with Simple/Advanced layering). Single-file gets uncomfortable at that size. Multi-file source with single-file output gives sane dev experience while preserving the "single HTML you can email" property.

### 12. Copilot treatment

**Decision:** Curated checkbox like other extensions, plus a small set of Copilot-specific defaults in the Advanced view (`github.copilot.advanced.publicCodeMatching: "block"`, telemetry settings, etc.) automatically included when Copilot is selected. The chat companion (`github.copilot-chat`) is auto-added when the main extension is selected, with a tooltip noting how to opt out. The generator script never attempts to script auth — a comment documents that the user will see a sign-in prompt on first launch.

**Rationale:** Copilot is the one extension with non-trivial policy surface (telemetry, public code matching, data residency) that regulated orgs care about. Treating it as just-another-checkbox understates that. A dedicated UI section would overcorrect — risks signaling that the tool is primarily a Copilot deployment tool, which it isn't. Middle-ground in v1; dedicated section in v1.1 if demand warrants.

### 13. Channel

**Decision:** Stable only in v1. No Insiders selector. Counter to original doc.

**Rationale:** Insiders in Intune-managed contexts is rare — Insiders is a developer's personal-machine product, deployed via winget by individuals, not pushed via Intune to a fleet. Doubling the test surface (every install path, detection script, uninstall script, bootstrap variant) for an audience segment that's 2-5% of real users is a poor v1 trade. If demand emerges, add in v1.x.

### 14. Scope decomposition (user's hybrid: D + E)

**Decision:** Drop Active Setup entirely. The Intune SYSTEM-context script installs VS Code (and optionally seeds the Default profile for new users created after deployment) but does not attempt per-user catch-up. A separate user-context Intune script (PowerShell Script assigned to users, or Proactive Remediation) applies the baseline to each user in their own context, regardless of whether VS Code was installed by our SYSTEM script, by a previous deployment, or by the user themselves.

**Rationale:** This was the user's own restructure during the grill and it's better than my recommendation. It uses Intune's purpose-built user-context script channel rather than the legacy Active Setup mechanism, separates SYSTEM and user-context responsibilities cleanly, and handles the "user already has VS Code installed" case that Active Setup doesn't address. Per-baseline output grows from one script to a bundle of coordinated scripts, but each script is simpler and the architecture is more honest.

### 14b. User-script delivery mechanism

**Decision:** Generator emits both flavors. A one-shot `configure-user.ps1` for the standard Intune PowerShell Script (user assignment) channel — no premium SKU required. And a `detect-baseline.ps1` + `apply-baseline.ps1` pair for Proactive Remediations (the technically right answer for ongoing baseline drift detection, requires Endpoint Analytics licensing — included in M365 E3/E5/F3 and Intune P1).

**Rationale:** Proactive Remediations is the right answer technically, but tying v1 to a license SKU that not every customer has would gate adoption. Emitting both is cheap (the detection script is ~10 lines on top of the remediation script that's already written). Admin picks based on their licensing and process. Documentation explains the trade.

### 15. Pin-version mechanism without runtime network

**Decision:** Manual entry. When "pin VS Code version" toggles on, a text field appears for the admin to type the version. No build-time API call, no runtime fetch.

**Rationale:** Composes with extension pinning (Decision 8b, also manual entry). Admins who pin are deliberate about which version they're pinning to — they pinned for a reason. Build-time version baking would create a third deployment artifact to keep fresh (HTML + catalog + version snapshot) and complicate the "single HTML you can email" workflow. Always-emit-`/latest/` silently breaks the feature.

---

## Baseline schema (v1)

The schema is the foundational data structure. Every v1.x feature (diff view, importer evolution, history view, baseline registry) consumes it. Locking the shape now and versioning explicitly via `schemaVersion` lets future tool versions read v1 baselines without a migration mess.

```json
{
  "schemaVersion": 1,
  "toolVersion": "1.0.0",
  "baselineName": "Globeteam dev baseline",
  "createdAt": "2026-05-21T10:00:00Z",
  "platforms": ["windows", "macos"],
  "channel": "stable",
  "scope": "machine",
  "installSource": "bootstrapper",
  "mergetasks": ["addtopath", "addcontextmenufiles", "addcontextmenufolders"],
  "pinning": {
    "vscode": false,
    "vscodeVersion": null,
    "extensions": false
  },
  "extensions": {
    "curated": ["ms-vscode.powershell", "github.copilot"],
    "custom": ["redhat.vscode-yaml@1.14.0"]
  },
  "settings": {
    "telemetry.telemetryLevel": "off",
    "editor.formatOnSave": true,
    "github.copilot.advanced.publicCodeMatching": "block"
  },
  "copilot": {
    "enabled": true,
    "includeChat": true,
    "defaultsApplied": true
  },
  "notes": "Approved by security review ticket SEC-2026-0418"
}
```

URL hash encoding: `#b=<base64url(gzip(JSON))>`. Gzip yields ~3-4× compression on typical baselines, buying headroom against the practical 2KB URL cap. UI warns when an export would exceed 1800 chars and offers the JSON file download instead.

---

## Repo layout

```
vscode-baseline-generator/
├── src/
│   ├── components/             (Svelte components, one per UI section)
│   │   ├── InstallSection.svelte
│   │   ├── ExtensionsSection.svelte
│   │   ├── SettingsSection.svelte
│   │   ├── OutputSection.svelte
│   │   └── AdvancedDisclosure.svelte
│   ├── generators/
│   │   ├── windows-install.ts      (SYSTEM-context install script)
│   │   ├── windows-user.ts         (user-context configure script)
│   │   ├── windows-remediation.ts  (Proactive Remediation pair)
│   │   ├── windows-detection.ts
│   │   ├── windows-uninstall.ts
│   │   ├── macos-install.ts        (with LaunchAgent + code shim)
│   │   ├── macos-user.ts
│   │   ├── macos-detection.ts
│   │   ├── macos-uninstall.ts
│   │   ├── plain-powershell.ts     (interactive, winget-based)
│   │   ├── raw-files.ts            (extensions.txt + settings.json)
│   │   └── readme.ts               (per-bundle README generator)
│   ├── lib/
│   │   ├── jsonc-merge.ts          (user-wins merge with sidecar tracking)
│   │   ├── baseline-schema.ts      (zod or similar schema)
│   │   ├── url-hash.ts             (gzip + base64url)
│   │   ├── catalog.ts              (catalog loader and matcher)
│   │   └── extension-parser.ts     (code --list-extensions paste parser)
│   ├── catalog/
│   │   └── extensions.json         (the curated list, ~25 entries)
│   ├── App.svelte
│   └── main.ts
├── public/                         (static assets — favicon, og:image)
├── index.html                      (Vite entry — HTML shell, <title>, references /src/main.ts)
├── vite.config.ts                  (with vite-plugin-singlefile)
├── package.json
├── tsconfig.json
├── svelte.config.js
├── README.md                       (project README)
└── DESIGN.md                       (this file)
```

The `catalog/extensions.json` shape per entry:

```json
{
  "id": "ms-vscode.powershell",
  "displayName": "PowerShell",
  "publisher": "Microsoft",
  "category": "Languages",
  "description": "PowerShell language support",
  "recommendedFor": ["windows"],
  "lastVerified": "2026-05-21"
}
```

The `lastVerified` field is manually edited during quarterly review. Categories drive UI grouping. `recommendedFor` filters which platform contexts show the extension prominently (Mac-deploying admins probably don't need the PowerShell extension as a curated suggestion).

---

## Visual design

The VS Code Baseline Generator joins your existing Builder line (Edge-Favorit-Builder, PPPC-Builder). To stay recognizable as part of the same family, it inherits the full design system from those tools — same CSS variables, same button taxonomy, same shadow language, same interaction patterns. A user landing on this tool should immediately recognize it as "another Simsen Builder."

The signature of the design system is **green-tinted shadows**: every elevated surface, every button hover, every focus ring uses `rgba(90, 158, 37, ...)` rather than neutral gray. That alone is what makes the tools visually coherent across separate codebases.

### Color tokens (drop into `src/app.css`)

```css
:root {
  --primary:            #5a9e25;
  --primary-hover:      #4a8620;
  --primary-light:      #7cc242;
  --primary-dark:       #3d7018;
  --primary-glow:       rgba(90, 158, 37, 0.4);
  --primary-glow-strong:rgba(90, 158, 37, 0.6);
  --accent:             #6db832;
  --accent-light:       #8fd04a;
  --background:         #FAFAFA;
  --surface:            #FFFFFF;
  --text:               #1A1A1A;
  --text-secondary:     #666666;
  --border:             #E0E0E0;
  --shadow:             rgba(90, 158, 37, 0.15);
  --shadow-hover:       rgba(90, 158, 37, 0.3);
  --success:            #5a9e25;
  --danger:             #dc3545;
}
```

These variable names match Edge-Favorit-Builder and PPPC-Builder exactly. Use them verbatim so any future cross-tool styling work (a shared design tokens file, a brand refresh) touches one source.

### Typography

System font stack: `'Segoe UI', Tahoma, Geneva, Verdana, sans-serif`. This is deliberate — it reads as native on Windows (where most of your audience works) and avoids the friction of loading a web font in a `file://` context. Body line-height 1.6. H1 2.5rem, H2 1.5rem, subtitle 1.1rem with `--text-secondary`.

Monospace for the script preview pane and code samples: `'Consolas', 'Monaco', 'Courier New', monospace`. Same stack as the existing JSON output pane.

### Layout primitives

Page container is `max-width: 1200px`, centered, `padding: 2rem` (shrinks to 1rem at the 768px mobile breakpoint). Sections are white `--surface` cards with `border-radius: 12px`, `padding: 2rem`, `margin-bottom: 2rem`, and `box-shadow: 0 2px 8px var(--shadow)`. On hover the shadow deepens to `0 4px 20px var(--shadow-hover)` with a 0.3s ease transition — subtle elevation on interaction is part of the feel.

Spacing scale is rem-based: 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3. Avoid arbitrary values; stay on the scale.

### Button taxonomy

Five button variants, matching what's already in your codebase so the muscle memory transfers:

`.btn-primary` — green gradient (`--primary` → `--accent`), white text, green glow shadow. Use for the dominant action in a section (e.g., "Generate baseline").

`.btn-secondary` — accent gradient (`--accent` → `--accent-light`), white text. Use for secondary actions alongside primary (e.g., "Add extension").

`.btn-outline` — transparent background, `--primary` border + text, fills on hover. Use for tertiary actions.

`.btn-success` — gradient (`--primary` → `--primary-light`), white text. Use for completion or confirmation actions (e.g., "Copy script").

`.btn-export` / `.btn-import` — fixed 220px width, outlined style, uppercase. Reserved exclusively for the export/import action pair in the bundle output section. Don't reuse for other actions — the fixed width is a visual anchor that signals "this is data going in or out."

All buttons share: `8px` border-radius, uppercase text, `0.5px` letter-spacing, `font-weight: 600`, `translateY(-2px)` lift on hover with a deeper green-glow shadow, 0.3s ease transitions.

### The script preview pane (high-value detail)

Your existing JSON output pane (`#jsonOutput`) uses a dark "terminal" treatment: green text (`#8fd04a`) on a near-black green-tinted background (`linear-gradient(145deg, #1a2614 0%, #243320 50%, #1e2b18 100%)`), with text-shadow glow (`text-shadow: 0 0 8px rgba(90, 158, 37, 0.4)`) and inset+outer shadows that read like a CRT monitor effect.

**This pane should carry over verbatim for the PowerShell/shell script preview** in the new tool — it'll look fantastic for previewing PS1 and bash output, fits the Intune-admin "I live in terminals" aesthetic, and reuses an existing visual element that's recognizable from your other tools. Just swap "Copy JSON" for "Copy Script" and reuse the same `.json-section` styling (rename the class to `.script-section` if you want the semantic clarity, but the CSS rules carry across unchanged).

### Interaction patterns to preserve

- All transitions `0.3s ease` — don't introduce different timing curves
- Cards lift on hover (shadow deepens) — a quiet way of signaling interactivity
- Buttons rise on hover (`translateY(-2px)`) — explicit interactive feedback
- Focus rings use `0 0 0 3px rgba(90, 158, 37, 0.2)` — green-tinted, not the browser default blue
- The float animation on the logo (3s ease-in-out infinite, ±10px Y translation) — small detail, brand-consistent
- Modal entrance: `fadeIn` overlay + `slideUp` content, both 0.3s ease
- Toast entrance: `slideInRight` from the right edge, 0.3s ease
- Drag-over feedback uses `rgba(90, 158, 37, 0.05)` background tint + green border + green box-shadow glow

These animations are part of how the tools feel, not decoration. Reproduce them.

### Svelte-specific note

Existing apps are vanilla JS with one `styles.css`. The new tool is Svelte + Vite, so the global tokens above go in `src/app.css` (imported once in `main.ts`), while component-scoped styling lives inside each `.svelte` file's `<style>` block. CSS variables defined in `:root` are accessible from any component without re-declaration. Don't put button classes in component scope — they belong in the global stylesheet so the taxonomy stays consistent across components and stays visually-similar to the other Builder apps.

### Naming consistency

Your existing tools are `Edge-Favorit-Builder` and `PPPC-Builder`. Following that convention, this tool is naturally `VSCode-Builder` or `VSCode-Baseline-Builder`. The folder is already `VSCode Builder` and the doc was `VSCode_Builder.md`, so `VSCode-Builder` matches what you've already started. Recommend that as the GitHub repo name and the URL slug on simsenblog.dk (`/vscode-builder/`).

---

## v1 ship plan

Windows pipeline first (3-4 weekends). Validates the architecture end-to-end on the platform with the strongest community knowledge, the most mature tooling, and a test environment that's easier to assemble. Ship as v1.0 with Windows-only output. Mac follows as v1.1 (1-2 weekends) once an Intune-enrolled Mac is available for validation.

Test surface to cover before v1.0 ships, in order of confidence-building value:

End-to-end deploy on a fresh Windows VM enrolled in Intune. Generate a baseline, push the bundle through Intune, log in as a new user, verify VS Code present + extensions installed + settings.json contains baseline keys. Repeat on a VM where VS Code was preinstalled by another mechanism — the user-context script should still apply the baseline without re-installing VS Code. Then run a second baseline (modified settings) and verify user customizations between the two deploys survive (Decision 9 verification).

URL hash round-trip on a baseline with the catalog at full size, custom extensions, and a settings.json overlay of ~10 keys. Confirm the hash decodes byte-identical on import in a different browser session. Test the "URL too large" warning path with a deliberately oversized baseline (~80 extensions).

File download / file picker on Chrome, Edge, Safari, and Firefox under `file://`. Browsers handle `<a download>` and `<input type="file">` slightly differently in `file://` context; verify the experience is acceptable on each.

After v1.0 ships, v1.1 candidates in rough priority order: Mac platform support, the "diff view" stretch feature (paste an existing script, see what's missing from the baseline), Insiders channel if demand appears, marketplace API integration if the curated maintenance burden becomes painful, JSONC-preserving merge to fix the comment-loss limitation.
