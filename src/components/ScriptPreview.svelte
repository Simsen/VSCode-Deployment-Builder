<script lang="ts">
  // The terminal-styled output pane — carries over from the existing
  // Builder line (the dark green-on-near-black aesthetic used for
  // Edge-Favorit-Builder's #jsonOutput). Perfect for PowerShell + shell
  // previews because it reads as a real terminal at a glance.
  export let content: string = '';
  export let placeholder: string = 'Generated script will appear here...';
</script>

<textarea
  class="script-preview"
  readonly
  value={content}
  {placeholder}
></textarea>
