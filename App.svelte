<script lang="ts">
  import { onMount } from 'svelte';
  import ConfigSection from './components/ConfigSection.svelte';
  import InstallSection from './components/InstallSection.svelte';
  import ExtensionsSection from './components/ExtensionsSection.svelte';
  import SettingsSection from './components/SettingsSection.svelte';
  import CopilotSection from './components/CopilotSection.svelte';
  import OutputSection from './components/OutputSection.svelte';
  import ThemeToggle from './components/ThemeToggle.svelte';
  import { baseline } from './lib/state';
  import { encodeToHash } from './lib/url-hash';

  // Keep the URL hash in sync with the baseline so bookmarks and shared links work.
  onMount(() => {
    const unsub = baseline.subscribe(($b) => {
      try {
        const hash = encodeToHash($b);
        history.replaceState(null, '', hash);
      } catch (err) {
        // The encoder shouldn't fail under normal use, but if it does we'd
        // rather not crash the app — log and keep going.
        console.warn('Couldn\'t sync URL hash:', err);
      }
    });
    return unsub;
  });
</script>

<ThemeToggle />

<div class="container">
  <header>
    <h1>
      <svg class="logo" width="48" height="48" viewBox="0 0 24 24" fill="#5a9e25" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 4.5l9-3 9 6v12l-9 3-9-6V4.5zm9 1l-6 2 6 4 6-4-6-2zm-7 4v8l6 4v-8L5 9.5zm14 0l-6 4v8l6-4v-8z"/>
      </svg>
      VSCode Deployment Builder
    </h1>
    <p class="subtitle">Generate Intune-grade VS Code deployment bundles. Windows + macOS. Runs locally — your baseline never leaves the browser.</p>
  </header>

  <ConfigSection />
  <InstallSection />
  <ExtensionsSection />
  <SettingsSection />
  <CopilotSection />
  <OutputSection />

  <footer>
    <p>VSCode Deployment Builder · part of the <a href="https://simsenblog.dk/">Simsen Builder line</a></p>
    <p>All data is processed locally in your browser. Nothing is stored or sent to any server.</p>
  </footer>
</div>
