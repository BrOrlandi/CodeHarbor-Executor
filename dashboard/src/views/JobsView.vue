<template>
  <AppLayout>
    <div class="jobs-page">
      <h1 class="page-heading">Jobs</h1>

      <StatsCards :stats="stats" />

      <div class="toolbar">
        <select v-model="filters.status" class="input select" @change="loadJobs">
          <option value="">All Statuses</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
          <option value="pending">Pending</option>
          <option value="running">Running</option>
          <option value="imported">Imported</option>
          <option value="interrupted">Interrupted</option>
        </select>
        <input
          v-model="filters.search"
          type="text"
          placeholder="Search jobs..."
          class="input search"
          @input="debouncedSearch"
        />
      </div>

      <div class="table-wrap" v-if="jobs.length > 0">
        <table class="tbl">
          <thead>
            <tr>
              <th style="width: 100px">Status</th>
              <th>Job ID</th>
              <th>Cache Key</th>
              <th style="width: 110px">Time</th>
              <th style="width: 150px">Created</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="job in jobs"
              :key="job.job_id"
              class="tbl-row"
              @click="router.push({ name: 'job-detail', params: { jobId: job.job_id } })"
            >
              <td><JobStatusBadge :status="job.status" /></td>
              <td class="mono cell-id">{{ job.job_id }}</td>
              <td class="cell-cache">{{ job.cache_key || '–' }}</td>
              <td class="mono">{{ formatTime(job.execution_time_ms) }}</td>
              <td class="cell-date">{{ formatDate(job.created_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else-if="!loading" class="empty">
        <p>No jobs found</p>
        <router-link to="/create" class="empty-action">Execute your first job</router-link>
      </div>

      <div v-if="loading" class="loading">Loading...</div>

      <Pagination v-model="page" :total-pages="totalPages" @update:model-value="loadJobs" />
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/api/client.js';
import AppLayout from '@/components/AppLayout.vue';
import StatsCards from '@/components/StatsCards.vue';
import JobStatusBadge from '@/components/JobStatusBadge.vue';
import Pagination from '@/components/Pagination.vue';

const router = useRouter();
const jobs = ref([]);
const stats = ref({});
const loading = ref(false);
const page = ref(1);
const totalPages = ref(1);
const limit = 20;
const filters = reactive({ status: '', search: '' });
let searchTimeout = null;

function debouncedSearch() {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => { page.value = 1; loadJobs(); }, 300);
}

async function loadJobs() {
  loading.value = true;
  try {
    const params = new URLSearchParams({ page: page.value, limit, sortBy: 'created_at', sortOrder: 'desc' });
    if (filters.status) params.set('status', filters.status);
    if (filters.search) params.set('search', filters.search);
    const data = await api.get(`/jobs?${params}`);
    jobs.value = data.jobs || [];
    totalPages.value = data.totalPages || 1;
  } catch { jobs.value = []; } finally { loading.value = false; }
}

async function loadStats() {
  try { stats.value = await api.get('/jobs/stats'); } catch { stats.value = {}; }
}

function formatTime(ms) {
  if (ms == null) return '–';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(dateStr) {
  if (!dateStr) return '–';
  try {
    const d = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return dateStr; }
}

let refreshInterval = null;
onMounted(() => { loadJobs(); loadStats(); refreshInterval = setInterval(() => { loadJobs(); loadStats(); }, 10000); });
onBeforeUnmount(() => { if (refreshInterval) clearInterval(refreshInterval); if (searchTimeout) clearTimeout(searchTimeout); });
</script>

<style scoped>
.jobs-page { max-width: 1200px; }

.page-heading {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 24px;
  letter-spacing: -0.02em;
}

.toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.input {
  padding: 7px 12px;
  background: var(--bg-raised);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  transition: border-color var(--duration);
}

.input:focus { border-color: var(--brand); box-shadow: 0 0 0 2px var(--brand-wash); }
.input::placeholder { color: var(--text-muted); }
.select option { background: var(--bg-raised); }
.search { flex: 1; max-width: 280px; }

.table-wrap {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.tbl {
  width: 100%;
  border-collapse: collapse;
}

.tbl th {
  text-align: left;
  padding: 10px 16px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  font-weight: 600;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
}

.tbl td {
  padding: 10px 16px;
  font-size: 13px;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-secondary);
}

.tbl-row {
  cursor: pointer;
  transition: background var(--duration);
}

.tbl-row:hover { background: var(--bg-hover); }
.tbl-row:last-child td { border-bottom: none; }

.mono { font-family: var(--font-mono); font-size: 12px; }
.cell-id { color: var(--text-primary); }
.cell-cache { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cell-date { color: var(--text-muted); font-size: 12px; }

.empty {
  text-align: center;
  padding: 60px 24px;
  color: var(--text-muted);
}

.empty p { font-size: 14px; margin-bottom: 12px; }

.empty-action {
  font-size: 13px;
  color: var(--brand);
  font-weight: 500;
}

.empty-action:hover { color: var(--brand-light); }

.loading {
  text-align: center;
  padding: 40px;
  color: var(--text-muted);
  font-size: 13px;
}
</style>
