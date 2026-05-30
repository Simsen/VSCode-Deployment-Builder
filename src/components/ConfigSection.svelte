<script lang="ts">
  import { baseline, patchBaseline } from '../lib/state';
  import type { Platform } from '../lib/baseline-schema';

  // Single-select: one baseline targets one platform. Cross-platform shops
  // maintain two baselines (export → switch platform → re-import preserves
  // extensions/settings; only the bundle scripts change).
  function selectPlatform(p: Platform) {
    if ($baseline.platforms[0] === p) return;
    patchBaseline({ platforms: [p] });
  }
</script>

<section class="config-section">
  <div class="section-header">
    <h2>Baseline</h2>
  </div>

  <div class="input-group">
    <label for="baselineName">Baseline name</label>
    <input
      id="baselineName"
      type="text"
      value={$baseline.baselineName}
      on:input={(e) => patchBaseline({ baselineName: e.currentTarget.value })}
      placeholder="e.g. Globeteam dev baseline"
    />
    <span class="input-hint">Shown in the bundle README and the baseline.json — useful when teams maintain several.</span>
  </div>

  <div class="input-group">
    <!-- svelte-ignore a11y-label-has-associated-control -->
    <label>Platform</label>
    <div role="radiogroup" aria-label="Target platform" style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
      <button
        type="button"
        role="radio"
        aria-checked={$baseline.platforms[0] === 'windows'}
        class="tab"
        class:active={$baseline.platforms[0] === 'windows'}
        on:click={() => selectPlatform('windows')}
      >
        Windows
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={$baseline.platforms[0] === 'macos'}
        class="tab"
        class:active={$baseline.platforms[0] === 'macos'}
        on:click={() => selectPlatform('macos')}
      >
        macOS
      </button>
    </div>
    <span class="input-hint">One baseline targets one platform. For cross-platform deployments, build a baseline for each — export, switch platform, re-import (extensions and settings carry over; scripts are regenerated).</span>
  </div>

  <div class="input-group">
    <label for="notes">Notes</label>
    <textarea
      id="notes"
      value={$baseline.notes}
      on:input={(e) => patchBaseline({ notes: e.currentTarget.value })}
      placeholder="Optional. e.g. 'Approved by security review SEC-2026-0418' — surfaced in baseline.json + README."
      rows="2"
    />
  </div>
</section>
