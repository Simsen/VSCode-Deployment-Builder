<script lang="ts">
  import AdvancedDisclosure from './AdvancedDisclosure.svelte';
  import { baseline, patchBaseline, patchPinning } from '../lib/state';
  import type { MergeTask, Scope } from '../lib/baseline-schema';

  const ALL_TASKS: { id: MergeTask; label: string; hint: string; defaultOn: boolean }[] = [
    { id: 'addtopath', label: 'Add to PATH', hint: 'Needed for `code` CLI — keep on unless you have a strong reason.', defaultOn: true },
    { id: 'addcontextmenufiles', label: 'Right-click "Open with Code" for files', hint: '', defaultOn: false },
    { id: 'addcontextmenufolders', label: 'Right-click "Open with Code" for folders', hint: '', defaultOn: false },
    { id: 'associatewithfiles', label: 'Register as default editor for supported file types', hint: 'Disabled by default in v1 — most orgs don\'t want VS Code claiming .txt / .json.', defaultOn: false },
    { id: 'runcode', label: 'Launch VS Code after install', hint: 'Leave off for unattended Intune deployments.', defaultOn: false }
  ];

  function toggleTask(task: MergeTask) {
    const has = $baseline.mergetasks.includes(task);
    const next = has
      ? $baseline.mergetasks.filter((t) => t !== task)
      : [...$baseline.mergetasks, task];
    patchBaseline({ mergetasks: next });
  }

  function setScope(s: Scope) {
    patchBaseline({ scope: s });
  }
</script>

<section class="builder-section">
  <div class="section-header">
    <h2>Install</h2>
  </div>

  <div class="input-group">
    <!-- svelte-ignore a11y-label-has-associated-control -->
    <label>Installer tasks</label>
    {#each ALL_TASKS as task}
      <label class="checkbox-row">
        <input
          type="checkbox"
          checked={$baseline.mergetasks.includes(task.id)}
          on:change={() => toggleTask(task.id)}
        />
        <div class="checkbox-content">
          <span class="checkbox-label">{task.label}</span>
          {#if task.hint}
            <span class="checkbox-hint">{task.hint}</span>
          {/if}
        </div>
      </label>
    {/each}
  </div>

  <AdvancedDisclosure label="Advanced install options">
    <div class="input-group">
      <!-- svelte-ignore a11y-label-has-associated-control -->
      <label>Scope (Plain PowerShell output only)</label>
      <div style="display: flex; gap: 0.5rem;">
        <button type="button" class="tab" class:active={$baseline.scope === 'machine'} on:click={() => setScope('machine')}>Per-machine</button>
        <button type="button" class="tab" class:active={$baseline.scope === 'user'} on:click={() => setScope('user')}>Per-user</button>
      </div>
      <span class="input-hint">Intune outputs are always per-machine — SYSTEM context can't sensibly install per-user. This setting only affects the plain PowerShell output.</span>
    </div>

    <div class="input-group">
      <label class="checkbox-row">
        <input
          type="checkbox"
          checked={$baseline.pinning.vscode}
          on:change={(e) => patchPinning({ vscode: e.currentTarget.checked })}
        />
        <div class="checkbox-content">
          <span class="checkbox-label">Pin VS Code version</span>
          <span class="checkbox-hint">Disables auto-update and pins to a specific version. For regulated environments and reproducible baselines.</span>
        </div>
      </label>
      {#if $baseline.pinning.vscode}
        <div style="margin-top: 0.5rem;">
          <input
            type="text"
            placeholder="e.g. 1.92.1"
            value={$baseline.pinning.vscodeVersion ?? ''}
            on:input={(e) => patchPinning({ vscodeVersion: e.currentTarget.value || null })}
          />
          <span class="input-hint">Type the exact version you want to pin. The generator embeds this into the download URL.</span>
        </div>
      {/if}
    </div>

    <div class="input-group">
      <label class="checkbox-row">
        <input
          type="checkbox"
          checked={$baseline.pinning.extensions}
          on:change={(e) => patchPinning({ extensions: e.currentTarget.checked })}
        />
        <div class="checkbox-content">
          <span class="checkbox-label">Pin extension versions</span>
          <span class="checkbox-hint">Turns off extension auto-update in settings.json. Use the <code>publisher.id@1.2.3</code> syntax in the custom extension field to actually pin specific versions.</span>
        </div>
      </label>
    </div>
  </AdvancedDisclosure>
</section>
