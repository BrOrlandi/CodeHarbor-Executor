<template>
  <AppLayout>
    <div class="detail" v-if="job">
      <header class="detail-top">
        <div class="detail-nav">
          <button class="back" @click="router.push({ name: 'jobs' })">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Jobs
          </button>
          <JobStatusBadge :status="job.status" />
          <span class="job-id mono">{{ job.job_id }}</span>
        </div>
        <div class="detail-actions">
          <button class="btn btn-primary" @click="reExecute">Re-Execute</button>
          <button class="btn btn-danger" @click="deleteJob">Delete</button>
        </div>
      </header>

      <div class="meta-grid">
        <div class="meta"><span class="meta-k">Cache Key</span><span class="meta-v">{{ job.cache_key || '–' }}</span></div>
        <div class="meta"><span class="meta-k">Created</span><span class="meta-v">{{ formatDate(job.created_at) }}</span></div>
        <div class="meta"><span class="meta-k">Completed</span><span class="meta-v">{{ formatDate(job.completed_at) }}</span></div>
        <div class="meta"><span class="meta-k">Exec Time</span><span class="meta-v mono">{{ formatMs(job.execution_time_ms) }}</span></div>
        <div class="meta"><span class="meta-k">Dep Install</span><span class="meta-v mono">{{ formatMs(job.dependency_install_time_ms) }}</span></div>
        <div class="meta"><span class="meta-k">Used Cache</span><span class="meta-v">{{ job.used_cache ? 'Yes' : 'No' }}</span></div>
      </div>

      <section class="section">
        <h2 class="section-h">Source Code</h2>
        <CodeViewer :code="job.code || ''" language="javascript" />
      </section>

      <section class="section" v-if="job.items">
        <h2 class="section-h">Input Items</h2>
        <JsonViewer :data="job.items" />
      </section>

      <section class="section" v-if="parsedDependencies.length > 0">
        <h2 class="section-h">Dependencies</h2>
        <div class="deps">
          <div v-for="dep in parsedDependencies" :key="dep.name" class="dep">
            <span>{{ dep.name }}</span>
            <span class="mono dep-ver">{{ dep.version }}</span>
          </div>
        </div>
      </section>

      <section class="section" v-if="job.console_output">
        <h2 class="section-h">Console Output</h2>
        <ConsoleOutput :output="job.console_output" />
      </section>

      <section class="section" v-if="resultBinary">
        <h2 class="section-h">Binary Output</h2>
        <BinaryViewer :data="resultBinary" />
      </section>

      <section class="section" v-if="job.status === 'success' && job.result_data">
        <h2 class="section-h">Result</h2>
        <JsonViewer :data="job.result_data" />
      </section>

      <section class="section" v-if="job.status === 'error'">
        <h2 class="section-h">Error</h2>
        <div class="error-block">
          <p class="error-msg" v-if="job.error_message">{{ job.error_message }}</p>
          <pre class="error-stack" v-if="job.error_stack">{{ job.error_stack }}</pre>
        </div>
      </section>

      <section class="section" v-if="parsedMetadata">
        <h2 class="section-h">Request Metadata</h2>
        <JsonViewer :data="job.request_metadata" :initial-expanded="false" />
      </section>
    </div>

    <div v-else-if="loading" class="state-msg">Loading...</div>
    <div v-else class="state-msg">Job not found</div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/api/client.js';
import AppLayout from '@/components/AppLayout.vue';
import JobStatusBadge from '@/components/JobStatusBadge.vue';
import CodeViewer from '@/components/CodeViewer.vue';
import JsonViewer from '@/components/JsonViewer.vue';
import ConsoleOutput from '@/components/ConsoleOutput.vue';
import BinaryViewer from '@/components/BinaryViewer.vue';

const props = defineProps({ jobId: { type: String, required: true } });
const router = useRouter();
const job = ref(null);
const loading = ref(true);

const parsedDependencies = computed(() => {
  if (!job.value?.dependencies) return [];
  try { return Object.entries(JSON.parse(job.value.dependencies)).map(([name, version]) => ({ name, version })); } catch { return []; }
});

const resultBinary = computed(() => {
  if (!job.value?.result_data) return null;
  try {
    const parsed = JSON.parse(job.value.result_data);
    // Result can be a single object with binary, or an array of items with binary
    if (Array.isArray(parsed)) {
      const allBinaries = {};
      parsed.forEach((item, i) => {
        if (item?.binary && typeof item.binary === 'object') {
          Object.entries(item.binary).forEach(([k, v]) => {
            allBinaries[parsed.length > 1 ? `[${i}].${k}` : k] = v;
          });
        }
      });
      return Object.keys(allBinaries).length > 0 ? allBinaries : null;
    }
    if (parsed?.binary && typeof parsed.binary === 'object') return parsed.binary;
    return null;
  } catch { return null; }
});

const parsedMetadata = computed(() => {
  if (!job.value?.request_metadata) return null;
  try { return JSON.parse(job.value.request_metadata); } catch { return null; }
});

function formatDate(d) { if (!d) return '–'; try { return new Date(d.endsWith?.('Z') ? d : d + 'Z').toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }); } catch { return d; } }
function formatMs(ms) { if (ms == null) return '–'; if (ms < 1000) return `${Math.round(ms)}ms`; return `${(ms / 1000).toFixed(2)}s`; }

async function loadJob() { loading.value = true; try { job.value = await api.get(`/jobs/${props.jobId}`); } catch { job.value = null; } finally { loading.value = false; } }
async function deleteJob() { if (!confirm('Delete this job?')) return; try { await api.del(`/jobs/${props.jobId}`); router.push({ name: 'jobs' }); } catch (e) { alert('Failed: ' + e.message); } }
function reExecute() { const q = {}; if (job.value.code) q.code = job.value.code; if (job.value.items) q.items = job.value.items; if (job.value.cache_key) q.cacheKey = job.value.cache_key; if (job.value.options) q.options = job.value.options; router.push({ name: 'create-job', query: q }); }

onMounted(loadJob);
</script>

<style scoped>
.detail { max-width: 960px; }

.detail-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}

.detail-nav {
  display: flex;
  align-items: center;
  gap: 12px;
}

.back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: 1px solid var(--border);
  color: var(--text-secondary);
  padding: 5px 10px;
  border-radius: var(--radius);
  font-size: 13px;
  transition: all var(--duration);
}

.back:hover { color: var(--text-primary); border-color: var(--text-muted); }

.job-id { font-size: 12px; color: var(--text-muted); }
.mono { font-family: var(--font-mono); }

.detail-actions { display: flex; gap: 6px; }

.btn {
  padding: 6px 14px;
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 500;
  border: 1px solid var(--border);
  transition: all var(--duration);
}

.btn-primary {
  background: var(--brand);
  border-color: var(--brand);
  color: #fff;
}

.btn-primary:hover { background: var(--brand-light); }

.btn-danger {
  background: none;
  color: var(--error);
  border-color: rgba(255, 69, 58, 0.3);
}

.btn-danger:hover { background: rgba(255, 69, 58, 0.08); }

.meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1px;
  background: var(--border);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  margin-bottom: 28px;
}

.meta {
  background: var(--bg-raised);
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.meta-k {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  font-weight: 600;
}

.meta-v {
  font-size: 13px;
  color: var(--text-primary);
}

.section { margin-bottom: 24px; }

.section-h {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 10px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.deps {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.dep {
  display: flex;
  justify-content: space-between;
  padding: 8px 16px;
  font-size: 13px;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-subtle);
}

.dep:last-child { border-bottom: none; }
.dep-ver { color: var(--text-muted); }

.error-block {
  background: rgba(255, 69, 58, 0.05);
  border: 1px solid rgba(255, 69, 58, 0.15);
  border-left: 3px solid var(--error);
  border-radius: var(--radius);
  padding: 16px;
}

.error-msg {
  color: var(--error);
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 10px;
}

.error-stack {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-muted);
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  line-height: 1.6;
}

.state-msg {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  color: var(--text-muted);
  font-size: 14px;
}
</style>
