<template>
  <div class="pagination" v-if="totalPages > 1">
    <button class="pg-btn" :disabled="modelValue <= 1" @click="emit('update:modelValue', modelValue - 1)">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <button
      v-for="page in visiblePages"
      :key="page"
      class="pg-btn"
      :class="{ current: page === modelValue, ellipsis: page === '...' }"
      :disabled="page === '...'"
      @click="page !== '...' && emit('update:modelValue', page)"
    >{{ page }}</button>
    <button class="pg-btn" :disabled="modelValue >= totalPages" @click="emit('update:modelValue', modelValue + 1)">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: { type: Number, required: true },
  totalPages: { type: Number, required: true },
});
const emit = defineEmits(['update:modelValue']);

const visiblePages = computed(() => {
  const total = props.totalPages;
  const current = props.modelValue;
  const pages = [];
  if (total <= 7) { for (let i = 1; i <= total; i++) pages.push(i); return pages; }
  pages.push(1);
  if (current > 3) pages.push('...');
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
});
</script>

<style scoped>
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 20px 0 4px;
}

.pg-btn {
  background: none;
  border: 1px solid transparent;
  color: var(--text-secondary);
  padding: 5px 10px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  min-width: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all var(--duration);
}

.pg-btn:hover:not(:disabled):not(.ellipsis) {
  color: var(--text-primary);
  background: var(--bg-hover);
  border-color: var(--border);
}

.pg-btn:disabled { opacity: 0.3; cursor: default; }
.pg-btn.ellipsis { cursor: default; color: var(--text-muted); }

.pg-btn.current {
  background: var(--brand);
  border-color: var(--brand);
  color: #fff;
  font-weight: 600;
}
</style>
