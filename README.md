# VS Code Builder

Browser-based generator that produces Intune-grade VS Code deployment bundles for Windows and macOS. Tick the extensions and settings you want, hit generate, get a complete bundle: SYSTEM install script, user-context configure script, detection rule, uninstall, and a per-bundle README explaining how to deploy it all in Intune.

Part of the Simsen Builder line — same look-and-feel as [Edge-Favorit-Builder](https://github.com/Simsen/edge-favorit-builder) and [PPPC-Builder](https://github.com/Simsen/PPPC-Builder).

🔗 https://www.simsenblog.dk/vscode-builder/ *(coming soon)*

## What it generates

For each baseline you build, the tool emits a coordinated bundle:

**Windows** — `install-system.ps1` (SYSTEM context, Intune Win32) + `configure-user.ps1` (user context, Intune PowerShell Script) + `detect-baseline.ps1` / `apply-baseline.ps1` (Proactive Remediation pair) + `detect-installed.ps1` + `uninstall.ps1`.

**macOS** — `install-system.sh` (SYSTEM context with LaunchAgent bootstrap) + `configure-user.sh` (user context for refresh / existing users) + `detect-installed.sh` + `uninstall.sh`.

**Plain PowerShell** — `vscode-baseline.ps1`, a single interactive script for non-Intune use.

Plus `baseline.json` (the canonical source you can re-import later) and a `README.md` explaining how to wire each file up in Intune.

The architecture decouples machine-level install (SYSTEM) from user-level configuration (user context) instead of using Active Setup. This is more Intune-native and handles the "user already has VS Code installed" case cleanly. See [DESIGN.md](./DESIGN.md) for the full decision log — 15 architectural decisions made via grill-me before a line of code was written.

## Running locally

```bash
npm install
npm run dev
```

The dev server runs on http://localhost:5173 with hot reload.

## Building

```bash
npm run build
```

Produces a single self-contained `dist/index.html` — all JavaScript, CSS, and the extension catalog inlined. Open it from `file://` in any modern browser and it works offline. Email it, drop it on a USB stick, or host it from any static server.

## Repository layout

```
src/
├── components/         (Svelte components — one per UI section)
├── generators/         (per-platform script generators)
├── lib/                (schema, jsonc merge, URL hash, catalog loader)
├── catalog/            (curated extension list — hand-maintained, quarterly review)
├── App.svelte
├── app.css             (brand tokens shared across the Builder line)
└── main.ts
index.html              (Vite entry — references /src/main.ts)
vite.config.ts          (single-file output via vite-plugin-singlefile)
DESIGN.md               (15-decision design doc — read this first)
```

## Maintaining the catalog

The extension catalog at `src/catalog/extensions.json` is hand-curated. Quarterly review cadence:

1. Check each entry's `id` still resolves in the marketplace.
2. Update `lastVerified` on entries you confirmed.
3. Update the top-level `lastReview` to the review date.
4. Add or remove entries based on what's actually in demand.

Manual maintenance is intentional — see DESIGN.md Decision 7 for the trade-off vs live marketplace integration.

## Architecture & decision log

The full design rationale lives in [DESIGN.md](./DESIGN.md). Key calls:

- **Active Setup is NOT used.** Per-user work happens via a separate Intune user-context script (Windows) or LaunchAgent (macOS), which is more Intune-native and handles pre-existing VS Code installs.
- **settings.json merge is user-wins.** Baseline keys are defaults; user customizations always survive. A managed-keys sidecar tracks which keys we own.
- **No runtime network calls.** Curated extension catalog is bundled; output works from `file://`.
- **Single HTML output** via `vite-plugin-singlefile`. Multi-file source for dev sanity.
- **Version pinning is manual entry.** No build-time API calls, no runtime fetches.

## License

Provided as-is for the endpoint management community.

## Credits

Built by Simon Skotheimsvik — Senior Endpoint Architect, Microsoft MVP — to make VS Code deployment via Intune less tedious. The brand and design system are shared with the rest of the Builder line.
