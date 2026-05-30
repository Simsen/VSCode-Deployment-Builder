<script lang="ts">
  import ScriptPreview from './ScriptPreview.svelte';
  import { baseline, bundle, hashSize, HASH_WARN_THRESHOLD, resetBaseline } from '../lib/state';
  import { encodeToHash } from '../lib/url-hash';
  import { validateBaseline, normalizeBaseline } from '../lib/baseline-schema';
  import { SCENARIOS, REFERENCE_PATHS, type Scenario } from '../lib/scenarios';
  import type { BundleFile } from '../generators';

  let fileInput: HTMLInputElement;
  let toast: { kind: 'success' | 'error'; text: string } | null = null;

  // ─── Scenario selection ────────────────────────────────────────────
  // Only scenarios for selected platforms are offered.
  $: availableScenarios = SCENARIOS.filter((s) => $baseline.platforms.includes(s.platform));

  let activeScenarioId = '';
  $: if (!availableScenarios.find((s) => s.id === activeScenarioId)) {
    activeScenarioId = availableScenarios[0]?.id ?? '';
  }
  $: activeScenario = availableScenarios.find((s) => s.id === activeScenarioId);

  // Resolve scenario steps to actual BundleFile objects.
  $: scenarioFiles = activeScenario
    ? activeScenario.steps
        .map((step) => ({ deployAs: step.deployAs, file: $bundle.find((f) => f.path === step.filePath) }))
        .filter((s): s is { deployAs: string; file: BundleFile } => s.file !== undefined)
    : [];

  // Always-visible reference files (independent of scenario).
  $: referenceFiles = $bundle.filter((f) => REFERENCE_PATHS.includes(f.path));

  // ─── Active file in the preview ────────────────────────────────────
  // Tracks the currently selected file across both scenario and reference rows.
  let activePath = '';
  $: if (!activePath || ![...scenarioFiles.map((s) => s.file.path), ...referenceFiles.map((f) => f.path)].includes(activePath)) {
    activePath = scenarioFiles[0]?.file.path ?? referenceFiles[0]?.path ?? '';
  }
  $: active = $bundle.find((f) => f.path === activePath);

  // ─── Helpers ───────────────────────────────────────────────────────
  function filename(file: BundleFile): string {
    return file.path.includes('/') ? file.path.split('/').slice(-1)[0] : file.path;
  }

  function langIcon(lang: BundleFile['language']): string {
    if (lang === 'powershell') return '⌘';
    if (lang === 'bash') return '$';
    if (lang === 'json') return '{}';
    return '¶';
  }

  function selectScenario(s: Scenario) {
    activeScenarioId = s.id;
    activePath = s.steps[0]?.filePath ?? activePath;
  }

  function showToast(text: string, kind: 'success' | 'error' = 'success') {
    toast = { text, kind };
    setTimeout(() => (toast = null), 3000);
  }

  async function copyActive() {
    if (!active) return;
    try {
      await navigator.clipboard.writeText(active.content);
      showToast(`Copied ${filename(active)}`);
    } catch (err) {
      showToast(`Couldn't copy: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  }

  function downloadActive() {
    if (!active) return;
    triggerDownload(filename(active), active.content);
  }

  function downloadBundleZip() {
    for (const f of $bundle) {
      triggerDownload(f.path.replace(/\//g, '_'), f.content);
    }
    showToast(`Downloaded ${$bundle.length} files`);
  }

  function exportBaselineJson() {
    triggerDownload(
      `${slugify($baseline.baselineName)}.baseline.json`,
      JSON.stringify($baseline, null, 2)
    );
    showToast('Baseline JSON downloaded');
  }

  function copyShareUrl() {
    try {
      const hash = encodeToHash($baseline);
      const url = window.location.origin + window.location.pathname + hash;
      navigator.clipboard.writeText(url).then(
        () => showToast('Share URL copied'),
        () => showToast("Couldn't copy URL", 'error')
      );
    } catch (err) {
      showToast(`Couldn't encode: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  }

  function triggerImport() {
    fileInput.click();
  }

  async function handleImport(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      validateBaseline(parsed);
      const normalized = normalizeBaseline(parsed);
      baseline.set(normalized);
      showToast(`Imported "${normalized.baselineName}"`);
    } catch (err) {
      showToast(`Import failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
    fileInput.value = '';
  }

  function triggerDownload(name: string, content: string) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function slugify(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'baseline';
  }
</script>

<section class="script-section">
  <div class="section-header">
    <h2>Bundle output</h2>
    <div class="action-buttons">
      <button type="button" class="btn btn-import" on:click={triggerImport}>Import baseline.json</button>
      <button type="button" class="btn btn-export" on:click={exportBaselineJson}>Export baseline.json</button>
    </div>
    <input
      bind:this={fileInput}
      type="file"
      accept="application/json,.json"
      style="display: none"
      on:change={handleImport}
    />
  </div>

  <div class="scenario-strip">
    {#each availableScenarios as s}
      <button
        type="button"
        class="scenario-tab"
        class:active={s.id === activeScenarioId}
        on:click={() => selectScenario(s)}
      >
        {s.label}
      </button>
    {/each}
  </div>

  {#if activeScenario}
    <div class="scenario-description">
      <p>{activeScenario.description}</p>
      {#if activeScenario.caveat}
        <p class="scenario-caveat"><strong>Note:</strong> {activeScenario.caveat}</p>
      {/if}
    </div>
  {/if}

  <div class="bundle-layout">
    <aside class="bundle-files" aria-label="Bundle file list">
      <div class="file-group">
        <div class="file-group-label">Deployment steps</div>
        <ul class="file-list">
          {#each scenarioFiles as { deployAs, file }, i}
            <li>
              <button
                type="button"
                class="file-row scenario-step"
                class:active={file.path === activePath}
                on:click={() => (activePath = file.path)}
                title={file.path}
              >
                <span class="step-number" aria-hidden="true">{i + 1}</span>
                <span class="file-meta">
                  <span class="file-name">{filename(file)}</span>
                  <span class="file-subtitle">{deployAs}</span>
                </span>
              </button>
            </li>
          {/each}
        </ul>
      </div>

      <div class="file-group">
        <div class="file-group-label">Reference</div>
        <ul class="file-list">
          {#each referenceFiles as file}
            <li>
              <button
                type="button"
                class="file-row"
                class:active={file.path === activePath}
                on:click={() => (activePath = file.path)}
                title={file.path}
              >
                <span class="file-icon" aria-hidden="true">{langIcon(file.language)}</span>
                <span class="file-meta">
                  <span class="file-name">{filename(file)}</span>
                  <span class="file-subtitle">{file.language === 'json' ? 'canonical baseline source' : 'deployment guide'}</span>
                </span>
              </button>
            </li>
          {/each}
        </ul>
      </div>
    </aside>

    <div class="bundle-preview">
      <ScriptPreview content={active?.content ?? ''} />
    </div>
  </div>

  <div class="bundle-actions">
    <button type="button" class="btn btn-primary" on:click={copyActive} disabled={!active}>Copy</button>
    <button type="button" class="btn btn-secondary" on:click={downloadActive} disabled={!active}>Download file</button>
    <button type="button" class="btn btn-success" on:click={downloadBundleZip}>Download bundle</button>
    <button type="button" class="btn btn-outline" on:click={copyShareUrl}>Copy share URL</button>
    <button type="button" class="btn btn-cancel" on:click={resetBaseline}>Reset</button>
  </div>

  {#if $hashSize > HASH_WARN_THRESHOLD}
    <div class="note warning">
      <strong>URL hash is large ({$hashSize} chars).</strong> Some platforms truncate long URLs.
      Use the JSON file export instead for sharing this baseline.
    </div>
  {/if}

  {#if toast}
    <div class="toast" class:error={toast.kind === 'error'}>
      {toast.text}
    </div>
  {/if}
</section>
