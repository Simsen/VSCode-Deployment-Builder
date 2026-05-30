<script lang="ts">
  import AdvancedDisclosure from './AdvancedDisclosure.svelte';
  import { baseline, patchSettings } from '../lib/state';

  // Curated "common defaults" — most admins want one of these toggled.
  // Anything more exotic goes through the raw JSON editor below.
  type Toggle = { key: string; label: string; hint: string; on: unknown; off: unknown };

  const TOGGLES: Toggle[] = [
    {
      key: 'telemetry.telemetryLevel',
      label: 'Telemetry off',
      hint: 'Sets telemetry.telemetryLevel to "off". Common in regulated environments.',
      on: 'off',
      off: 'all'
    },
    {
      key: 'editor.formatOnSave',
      label: 'Format on save',
      hint: 'Run the configured formatter every time a file is saved.',
      on: true,
      off: false
    },
    {
      key: 'workbench.startupEditor',
      label: 'Skip the welcome page',
      hint: 'Sets workbench.startupEditor to "none" — open a blank editor instead of the welcome tab.',
      on: 'none',
      off: 'welcomePage'
    },
    {
      key: 'editor.minimap.enabled',
      label: 'Disable minimap',
      hint: 'Hides the small overview map on the right of the editor.',
      on: false,
      off: true
    }
  ];

  function isOn(t: Toggle): boolean {
    return $baseline.settings[t.key] === t.on;
  }

  function toggle(t: Toggle) {
    const next = isOn(t) ? t.off : t.on;
    patchSettings({ [t.key]: next });
  }

  let rawDraft = JSON.stringify($baseline.settings, null, 2);
  let rawError = '';
  let rawOpen = false;

  function applyRaw() {
    rawError = '';
    try {
      const parsed = JSON.parse(rawDraft);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        rawError = 'Must be a JSON object at the top level.';
        return;
      }
      baseline.update((b) => ({ ...b, settings: parsed as Record<string, unknown> }));
    } catch (err) {
      rawError = `JSON parse error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  // Keep the raw editor in sync when the baseline changes externally
  // (e.g. import). Only refresh when the user isn't actively editing.
  $: if (!rawOpen) {
    rawDraft = JSON.stringify($baseline.settings, null, 2);
  }
</script>

<section class="builder-section">
  <div class="section-header">
    <h2>Settings overlay</h2>
  </div>

  <div class="input-group">
    <!-- svelte-ignore a11y-label-has-associated-control -->
    <label>Common defaults</label>
    {#each TOGGLES as t}
      <label class="checkbox-row">
        <input type="checkbox" checked={isOn(t)} on:change={() => toggle(t)} />
        <div class="checkbox-content">
          <span class="checkbox-label">{t.label}</span>
          <span class="checkbox-hint">{t.hint}</span>
        </div>
      </label>
    {/each}
  </div>

  <AdvancedDisclosure label="Edit settings.json overlay directly" bind:open={rawOpen}>
    <div class="input-group">
      <label for="rawSettings">Raw JSON</label>
      <textarea
        id="rawSettings"
        bind:value={rawDraft}
        rows="10"
        spellcheck="false"
      />
      <div style="margin-top: 0.5rem; display: flex; gap: 0.5rem; align-items: center;">
        <button type="button" class="btn btn-outline" on:click={applyRaw}>Apply</button>
        {#if rawError}
          <span class="input-hint" style="color: var(--danger); margin: 0;">{rawError}</span>
        {/if}
      </div>
      <span class="input-hint">Keys here are merged into the user's settings.json with user-wins semantics — see DESIGN.md Decision 9.</span>
    </div>
  </AdvancedDisclosure>
</section>
