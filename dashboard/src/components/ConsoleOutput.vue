<template>
  <div class="console">
    <div v-if="entries.length === 0" class="console-empty">No console output</div>
    <div v-for="(entry, i) in entries" :key="i" class="line" :class="entry.type">
      <span class="line-tag">{{ entry.type }}</span>
      <span class="line-ts">{{ formatTime(entry.timestamp) }}</span>
      <span class="line-msg">{{ entry.message }}</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({ output: { type: String, default: '[]' } });
const entries = computed(() => { try { return JSON.parse(props.output) || []; } catch { return []; } });

function formatTime(ts) {
  if (!ts) return '';
  try { return new Date(ts).toLocaleTimeString('en-US', { hour12: false, fractionalSecondDigits: 3 }); } catch { return ts; }
}
</script>

<style scoped>
.console {
  background: var(--bg-inset);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 10px;
  font-family: var(--font-mono);
  font-size: 12px;
  max-height: 400px;
  overflow-y: auto;
}

.console-empty { color: var(--text-muted); font-style: italic; padding: 6px; }

.line {
  display: flex;
  gap: 8px;
  padding: 2px 4px;
  border-radius: var(--radius-sm);
  align-items: baseline;
}

.line:hover { background: rgba(255,255,255, 0.02); }

.line-tag {
  font-size: 9px;
  text-transform: uppercase;
  font-weight: 700;
  min-width: 36px;
  letter-spacing: 0.04em;
}

.line-ts { color: var(--text-muted); font-size: 10px; min-width: 80px; }
.line-msg { flex: 1; white-space: pre-wrap; word-break: break-word; }

.line.log { color: var(--text-primary); }
.line.log .line-tag { color: var(--text-muted); }
.line.error { color: var(--error); background: rgba(255, 69, 58, 0.04); }
.line.warn { color: var(--warning); background: rgba(255, 159, 10, 0.04); }
.line.info { color: var(--info); }
.line.debug { color: var(--text-muted); }
</style>
