<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  let isExporting = false;

  function handleExport() {
    isExporting = true;
    dispatch('export');
    // Reset state after a short delay or based on prop
    setTimeout(() => {
        isExporting = false;
    }, 2000);
  }
</script>

<div class="feedback-widget">
  <button class="trigger-btn" on:click={handleExport} disabled={isExporting}>
    {#if isExporting}
      Exporting...
    {:else}
      🐛 Report Bug
    {/if}
  </button>
</div>

<style>
  .feedback-widget {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 9999;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }

  .trigger-btn {
    background-color: #ff4757;
    color: white;
    border: none;
    border-radius: 24px;
    padding: 12px 24px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    transition: transform 0.2s, background-color 0.2s;
  }

  .trigger-btn:hover {
    background-color: #ff6b81;
    transform: translateY(-2px);
  }
  
  .trigger-btn:disabled {
      background-color: #ccc;
      cursor: not-allowed;
      transform: none;
  }
</style>
