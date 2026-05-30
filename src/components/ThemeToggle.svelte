<script lang="ts">
  import { onMount } from 'svelte';

  // 'dark' is the default; persisted across reloads.
  let theme: 'dark' | 'light' = 'dark';

  function apply(t: 'dark' | 'light') {
    theme = t;
    document.documentElement.setAttribute('data-theme', t);
    try {
      localStorage.setItem('vscb-theme', t);
    } catch {
      // Ignore quota / privacy-mode errors — toggle still works for the session.
    }
  }

  onMount(() => {
    let initial: 'dark' | 'light' = 'dark';
    try {
      const saved = localStorage.getItem('vscb-theme');
      if (saved === 'light' || saved === 'dark') initial = saved;
    } catch {
      // Ignore — fall back to dark.
    }
    apply(initial);
  });
</script>

<div class="theme-toggle" role="group" aria-label="Color theme">
  <button
    type="button"
    class="theme-btn"
    class:active={theme === 'light'}
    aria-pressed={theme === 'light'}
    aria-label="Light mode"
    title="Light mode"
    on:click={() => apply('light')}
  >
    <!-- Sun -->
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  </button>
  <button
    type="button"
    class="theme-btn"
    class:active={theme === 'dark'}
    aria-pressed={theme === 'dark'}
    aria-label="Dark mode"
    title="Dark mode"
    on:click={() => apply('dark')}
  >
    <!-- Moon -->
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
         aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  </button>
</div>

<style>
  .theme-toggle {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 1000;
    display: inline-flex;
    gap: 0.25rem;
    padding: 0.25rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 999px;
    box-shadow: 0 2px 8px var(--shadow);
  }

  .theme-btn {
    width: 32px;
    height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 999px;
    cursor: pointer;
    color: var(--text-secondary);
    transition: background 0.2s ease, color 0.2s ease;
  }

  .theme-btn:hover {
    color: var(--primary);
    background: rgba(90, 158, 37, 0.1);
  }

  .theme-btn.active {
    color: white;
    background: var(--primary);
    box-shadow: 0 2px 6px var(--primary-glow);
  }

  @media (max-width: 768px) {
    .theme-toggle {
      top: 0.5rem;
      right: 0.5rem;
    }
  }
</style>
