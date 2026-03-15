<template>
  <span class="status" :class="status">
    <span class="status-dot"></span>
    {{ label }}
  </span>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  status: {
    type: String,
    required: true,
    validator: (v) => ['pending', 'running', 'success', 'error', 'imported'].includes(v),
  },
});

const label = computed(() => props.status.charAt(0).toUpperCase() + props.status.slice(1));
</script>

<style scoped>
.status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  padding: 4px 8px 4px 6px;
  border-radius: 3px;
  white-space: nowrap;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.success { color: var(--success); background: rgba(52, 199, 89, 0.1); }
.success .status-dot { background: var(--success); }

.error { color: var(--error); background: rgba(255, 69, 58, 0.1); }
.error .status-dot { background: var(--error); }

.pending { color: var(--pending); background: rgba(191, 90, 242, 0.1); }
.pending .status-dot { background: var(--pending); animation: pulse 1.5s ease-in-out infinite; }

.running { color: var(--running); background: rgba(255, 159, 10, 0.1); }
.running .status-dot { background: var(--running); animation: pulse 1s ease-in-out infinite; }

.imported { color: var(--imported); background: rgba(136, 153, 173, 0.1); }
.imported .status-dot { background: var(--imported); }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>
