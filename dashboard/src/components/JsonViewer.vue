<template>
  <div class="json-wrap">
    <div class="json-bar">
      <button class="bar-btn" @click="expanded = !expanded">{{ expanded ? 'Collapse' : 'Expand' }}</button>
      <button class="bar-btn" @click="copyToClipboard">{{ copied ? 'Copied' : 'Copy' }}</button>
    </div>
    <div class="json-body" :class="{ collapsed: !expanded }">
      <pre><code>{{ formattedJson }}</code></pre>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
  data: { type: String, default: '{}' },
  initialExpanded: { type: Boolean, default: true },
});

const expanded = ref(props.initialExpanded);
const copied = ref(false);

const formattedJson = computed(() => { try { return JSON.stringify(JSON.parse(props.data), null, 2); } catch { return props.data; } });

async function copyToClipboard() {
  try { await navigator.clipboard.writeText(formattedJson.value); copied.value = true; setTimeout(() => { copied.value = false; }, 2000); } catch {}
}
</script>

<style scoped>
.json-wrap { border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }

.json-bar {
  display: flex; gap: 4px; padding: 6px 10px;
  background: var(--bg-surface); border-bottom: 1px solid var(--border);
}

.bar-btn {
  background: none; border: 1px solid var(--border); color: var(--text-muted);
  padding: 3px 8px; border-radius: var(--radius-sm); font-size: 11px;
  transition: all var(--duration); font-weight: 500;
}
.bar-btn:hover { color: var(--text-primary); border-color: var(--text-muted); }

.json-body {
  background: var(--bg-inset); padding: 14px; overflow: auto;
  max-height: 500px; transition: max-height var(--duration) var(--ease-out);
}
.json-body.collapsed { max-height: 100px; }

pre { margin: 0; font-family: var(--font-mono); font-size: 12px; line-height: 1.5; color: var(--text-primary); white-space: pre-wrap; word-break: break-word; }
</style>
