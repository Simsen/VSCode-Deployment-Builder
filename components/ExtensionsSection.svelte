<script lang="ts">
  import AdvancedDisclosure from './AdvancedDisclosure.svelte';
  import { baseline, patchExtensions } from '../lib/state';
  import { catalog, groupByCategory } from '../lib/catalog';
  import { isValidExtensionId, stripVersion } from '../lib/baseline-schema';
  import { parseExtensionPaste, partitionAgainstCatalog } from '../lib/extension-parser';
  import { catalogIds } from '../lib/catalog';

  let pasteBoxValue = '';
  let pasteFeedback = '';

  let customDraft = '';
  let customError = '';

  $: grouped = groupByCategory();

  function toggleCurated(id: string) {
    const has = $baseline.extensions.curated.includes(id);
    const next = has
      ? $baseline.extensions.curated.filter((x) => x !== id)
      : [...$baseline.extensions.curated, id];
    patchExtensions({ curated: next });
  }

  function addCustom() {
    customError = '';
    const trimmed = customDraft.trim();
    if (!trimmed) return;
    if (!isValidExtensionId(trimmed)) {
      customError = `"${trimmed}" doesn't look like a valid extension id. Expected: publisher.name or publisher.name@version`;
      return;
    }
    // Don't double-add if it matches a curated entry (sans version)
    const base = stripVersion(trimmed).toLowerCase();
    const isCurated = catalogIds.some((id) => id.toLowerCase() === base);
    if (isCurated && !trimmed.includes('@')) {
      customError = `"${base}" is already in the curated list — tick the checkbox instead.`;
      return;
    }
    if ($baseline.extensions.custom.includes(trimmed)) {
      customError = `"${trimmed}" is already in the custom list.`;
      return;
    }
    patchExtensions({ custom: [...$baseline.extensions.custom, trimmed] });
    customDraft = '';
  }

  function removeCustom(id: string) {
    patchExtensions({ custom: $baseline.extensions.custom.filter((x) => x !== id) });
  }

  function applyPaste() {
    pasteFeedback = '';
    const result = parseExtensionPaste(pasteBoxValue);
    if (result.valid.length === 0 && result.invalid.length === 0) {
      pasteFeedback = 'Nothing to import — paste the output of `code --list-extensions`.';
      return;
    }
    const partition = partitionAgainstCatalog(result.valid, catalogIds);
    const newCurated = new Set([...$baseline.extensions.curated, ...partition.curatedHits]);
    const newCustom = new Set([...$baseline.extensions.custom, ...partition.custom]);
    patchExtensions({
      curated: Array.from(newCurated),
      custom: Array.from(newCustom)
    });

    const parts: string[] = [];
    if (partition.curatedHits.length) parts.push(`${partition.curatedHits.length} matched curated entry`);
    if (partition.custom.length) parts.push(`${partition.custom.length} went to custom`);
    if (result.invalid.length) parts.push(`${result.invalid.length} couldn't be parsed`);
    pasteFeedback = parts.join(', ');
    pasteBoxValue = '';
  }
</script>

<section class="builder-section">
  <div class="section-header">
    <h2>Extensions</h2>
  </div>

  {#each Array.from(grouped.entries()) as [category, entries]}
    <div class="input-group">
      <!-- svelte-ignore a11y-label-has-associated-control -->
      <label>{category}</label>
      <div class="extension-grid">
        {#each entries as ext}
          <label
            class="extension-chip checkbox-row"
            class:checked={$baseline.extensions.curated.includes(ext.id)}
          >
            <input
              type="checkbox"
              checked={$baseline.extensions.curated.includes(ext.id)}
              on:change={() => toggleCurated(ext.id)}
            />
            <div class="checkbox-content">
              <span class="checkbox-label">{ext.displayName}</span>
              <span class="checkbox-hint">{ext.description}</span>
              <span class="checkbox-hint" style="font-family: 'Consolas', 'Monaco', monospace; opacity: 0.7;">{ext.id}</span>
            </div>
          </label>
        {/each}
      </div>
    </div>
  {/each}

  <div class="input-group">
    <label for="customExt">Custom extensions (free-text)</label>
    <div style="display: flex; gap: 0.5rem;">
      <input
        id="customExt"
        type="text"
        placeholder="publisher.name or publisher.name@1.2.3"
        bind:value={customDraft}
        on:keydown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustom())}
      />
      <button type="button" class="btn btn-outline" on:click={addCustom}>Add</button>
    </div>
    {#if customError}
      <div class="note warning"><strong>Couldn't add:</strong> {customError}</div>
    {/if}
    {#if $baseline.extensions.custom.length > 0}
      <div class="custom-extension-list">
        {#each $baseline.extensions.custom as id}
          <div class="custom-extension-row">
            <code>{id.split('@')[0]}{#if id.includes('@')}<span class="version-pin">@{id.split('@')[1]}</span>{/if}</code>
            <button type="button" class="icon-btn danger" on:click={() => removeCustom(id)} aria-label="Remove">✕</button>
          </div>
        {/each}
      </div>
    {/if}
    <span class="input-hint">Catalog last reviewed {catalog.lastReview}. Need something not listed? Paste the publisher.name id here.</span>
  </div>

  <AdvancedDisclosure label="Import from a reference machine">
    <div class="input-group">
      <label for="pasteBox">Paste the output of <code>code --list-extensions</code></label>
      <textarea
        id="pasteBox"
        bind:value={pasteBoxValue}
        rows="6"
        placeholder="ms-vscode.powershell&#10;eamodio.gitlens&#10;github.copilot@1.187.0&#10;..."
      />
      <div style="margin-top: 0.5rem; display: flex; gap: 0.5rem; align-items: center;">
        <button type="button" class="btn btn-outline" on:click={applyPaste}>Import</button>
        {#if pasteFeedback}<span class="input-hint" style="margin: 0;">{pasteFeedback}</span>{/if}
      </div>
      <span class="input-hint">Each id matched against the curated list is ticked; the rest goes into custom. Lines with <code>@version</code> are preserved verbatim in custom.</span>
    </div>
  </AdvancedDisclosure>
</section>
