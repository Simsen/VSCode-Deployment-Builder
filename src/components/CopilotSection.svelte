<script lang="ts">
  import AdvancedDisclosure from './AdvancedDisclosure.svelte';
  import { baseline, patchCopilot } from '../lib/state';
</script>

<section class="builder-section">
  <div class="section-header">
    <h2>Copilot</h2>
  </div>

  <label class="checkbox-row">
    <input
      type="checkbox"
      checked={$baseline.copilot.enabled}
      on:change={(e) => patchCopilot({ enabled: e.currentTarget.checked })}
    />
    <div class="checkbox-content">
      <span class="checkbox-label">Include GitHub Copilot</span>
      <span class="checkbox-hint">
        Installs <code>github.copilot</code>. The user signs in on first VS Code launch —
        auth flows cannot be scripted. Ensure the user has a Copilot license assigned in your tenant.
      </span>
    </div>
  </label>

  {#if $baseline.copilot.enabled}
    <label class="checkbox-row">
      <input
        type="checkbox"
        checked={$baseline.copilot.includeChat}
        on:change={(e) => patchCopilot({ includeChat: e.currentTarget.checked })}
      />
      <div class="checkbox-content">
        <span class="checkbox-label">Include Copilot Chat companion</span>
        <span class="checkbox-hint">Auto-adds <code>github.copilot-chat</code>. Most users want this; uncheck only if you have a reason.</span>
      </div>
    </label>

    <AdvancedDisclosure label="Apply Copilot org defaults">
      <label class="checkbox-row">
        <input
          type="checkbox"
          checked={$baseline.copilot.defaultsApplied}
          on:change={(e) => patchCopilot({ defaultsApplied: e.currentTarget.checked })}
        />
        <div class="checkbox-content">
          <span class="checkbox-label">Set Copilot policy defaults in settings.json</span>
          <span class="checkbox-hint">Blocks public code matching, disables the welcome message. Review against your org's Copilot policy before deploying to regulated environments.</span>
        </div>
      </label>
    </AdvancedDisclosure>
  {/if}
</section>
