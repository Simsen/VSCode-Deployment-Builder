<script lang="ts">
  // Reusable Simple / Advanced disclosure — implements Decision 6's layered UX.
  // The Simple view always shows; advanced controls live inside <slot />.
  export let label: string = 'Advanced options';
  export let open: boolean = false;
</script>

<div class="advanced-disclosure">
  <button
    type="button"
    class="advanced-toggle"
    class:open
    on:click={() => (open = !open)}
    aria-expanded={open}
  >
    <span class="chevron">▶</span>
    {label}
  </button>
  {#if open}
    <div class="advanced-body">
      <slot />
    </div>
  {/if}
</div>
