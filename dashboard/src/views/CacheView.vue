<template>
  <AppLayout>
    <div class="cache-page">
      <h1 class="page-heading">Cache</h1>

      <div class="usage" v-if="cacheData">
        <div class="usage-top">
          <span class="usage-label">Disk Usage</span>
          <span class="usage-val mono">{{ formatSize(cacheData.totalSize) }} / {{ formatSize(cacheData.sizeLimit) }}</span>
        </div>
        <div class="bar"><div class="bar-fill" :class="{ warn: usagePercent > 75, crit: usagePercent > 90 }" :style="{ width: usagePercent + '%' }"></div></div>
        <span class="usage-pct">{{ usagePercent.toFixed(1) }}%</span>
      </div>

      <div class="table-wrap" v-if="entries.length > 0">
        <table class="tbl">
          <thead><tr><th style="width:28px"></th><th>Cache Key</th><th>Size</th><th>Jobs</th><th>Last Used</th></tr></thead>
          <tbody>
            <template v-for="(entry, i) in entries" :key="entry.key">
              <tr class="tbl-row" @click="toggleRow(i)">
                <td><svg class="expand-arrow" :class="{ open: expandedRows.has(i) }" width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M6 3l5 5-5 5z"/></svg></td>
                <td class="mono">{{ entry.key }}</td>
                <td>{{ formatSize(entry.size) }}</td>
                <td>{{ entry.jobCount }}</td>
                <td class="cell-date">{{ formatDate(entry.lastUsed) }}</td>
              </tr>
              <tr v-if="expandedRows.has(i)" class="expanded">
                <td colspan="5">
                  <div class="expanded-inner">
                    <div v-if="Object.keys(parseDeps(entry.dependencies)).length > 0">
                      <div v-for="(ver, name) in parseDeps(entry.dependencies)" :key="name" class="dep">
                        <span>{{ name }}</span><span class="mono dep-ver">{{ ver }}</span>
                      </div>
                    </div>
                    <span v-else class="no-data">No dependency info</span>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <div v-else-if="!loading" class="empty">No cache entries</div>
      <div v-if="loading" class="loading">Loading...</div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { api } from '@/api/client.js';
import AppLayout from '@/components/AppLayout.vue';

const cacheData = ref(null);
const entries = ref([]);
const loading = ref(true);
const expandedRows = ref(new Set());

const usagePercent = computed(() => {
  if (!cacheData.value || !cacheData.value.sizeLimit) return 0;
  return (cacheData.value.totalSize / cacheData.value.sizeLimit) * 100;
});

function toggleRow(i) { const s = new Set(expandedRows.value); s.has(i) ? s.delete(i) : s.add(i); expandedRows.value = s; }
function parseDeps(d) { if (!d) return {}; if (typeof d === 'string') { try { return JSON.parse(d); } catch { return {}; } } return d; }
function formatSize(b) { if (b == null) return '–'; if (b < 1024) return `${b} B`; if (b < 1048576) return `${(b/1024).toFixed(1)} KB`; if (b < 1073741824) return `${(b/1048576).toFixed(1)} MB`; return `${(b/1073741824).toFixed(1)} GB`; }
function formatDate(d) { if (!d) return '–'; try { return new Date(d.endsWith?.('Z') ? d : d + 'Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return d; } }

onMounted(async () => { loading.value = true; try { const d = await api.get('/cache'); cacheData.value = d; entries.value = d.entries || []; } catch { entries.value = []; } finally { loading.value = false; } });
</script>

<style scoped>
.cache-page { max-width: 960px; }
.page-heading { font-size: 22px; font-weight: 700; margin-bottom: 24px; letter-spacing: -0.02em; }

.usage {
  border: 1px solid var(--border); border-radius: var(--radius);
  padding: 16px 20px; margin-bottom: 20px; background: var(--bg-raised);
}
.usage-top { display: flex; justify-content: space-between; margin-bottom: 8px; }
.usage-label { font-size: 13px; font-weight: 600; color: var(--text-secondary); }
.usage-val { font-size: 13px; color: var(--text-primary); }
.mono { font-family: var(--font-mono); }

.bar { height: 6px; background: var(--bg-surface); border-radius: 3px; overflow: hidden; }
.bar-fill { height: 100%; background: var(--brand); border-radius: 3px; transition: width var(--duration); }
.bar-fill.warn { background: var(--warning); }
.bar-fill.crit { background: var(--error); }
.usage-pct { font-size: 11px; color: var(--text-muted); margin-top: 4px; display: block; }

.table-wrap { border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
.tbl { width: 100%; border-collapse: collapse; }
.tbl th { text-align: left; padding: 10px 16px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); font-weight: 600; background: var(--bg-surface); border-bottom: 1px solid var(--border); }
.tbl td { padding: 10px 16px; font-size: 13px; border-bottom: 1px solid var(--border-subtle); color: var(--text-secondary); }
.tbl-row { cursor: pointer; transition: background var(--duration); }
.tbl-row:hover { background: var(--bg-hover); }

.expand-arrow { color: var(--text-muted); transition: transform var(--duration); display: block; }
.expand-arrow.open { transform: rotate(90deg); }
.cell-date { color: var(--text-muted); font-size: 12px; }

.expanded td { padding: 0; border-bottom: 1px solid var(--border-subtle); }
.expanded-inner { padding: 12px 16px 12px 44px; background: var(--bg-base); }
.dep { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; color: var(--text-primary); }
.dep-ver { color: var(--text-muted); }
.no-data { color: var(--text-muted); font-size: 13px; font-style: italic; }
.empty, .loading { text-align: center; padding: 48px; color: var(--text-muted); font-size: 13px; }
</style>
