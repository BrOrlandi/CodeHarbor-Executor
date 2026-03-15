<template>
  <div class="stats">
    <div class="stat">
      <span class="stat-num">{{ stats.total ?? '–' }}</span>
      <span class="stat-label">Total</span>
    </div>
    <div class="stat">
      <span class="stat-num success">{{ stats.success ?? '–' }}</span>
      <span class="stat-label">Success</span>
    </div>
    <div class="stat">
      <span class="stat-num error">{{ stats.error ?? '–' }}</span>
      <span class="stat-label">Errors</span>
    </div>
    <div class="stat">
      <span class="stat-num info">{{ formattedAvgTime }}</span>
      <span class="stat-label">Avg Time</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  stats: { type: Object, default: () => ({}) },
});

const formattedAvgTime = computed(() => {
  const ms = props.stats.avgExecutionTimeMs;
  if (ms == null) return '–';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
});
</script>

<style scoped>
.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1px;
  background: var(--border);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  margin-bottom: 28px;
}

.stat {
  background: var(--bg-raised);
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-num {
  font-size: 24px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
  line-height: 1.2;
}

.stat-num.success { color: var(--success); }
.stat-num.error { color: var(--error); }
.stat-num.info { color: var(--brand); }

.stat-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

@media (max-width: 640px) {
  .stats {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
