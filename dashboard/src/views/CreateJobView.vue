<template>
  <AppLayout>
    <div class="create-page">
      <h1 class="page-heading">Execute</h1>

      <div class="form-stack">
        <section class="field-group">
          <label class="label">Code</label>
          <CodeEditor v-model="code" language="javascript" />
        </section>

        <section class="field-group">
          <label class="label">Input Items (JSON)</label>
          <CodeEditor v-model="items" language="json" />
        </section>

        <div class="form-row">
          <section class="field-group">
            <label class="label" for="cacheKey">Cache Key <span class="req">*</span></label>
            <input id="cacheKey" type="text" v-model="cacheKey" placeholder="e.g. my-workflow-hash" class="input" />
          </section>
          <section class="field-group">
            <label class="label" for="timeout">Timeout (ms)</label>
            <input id="timeout" type="number" v-model.number="timeout" class="input" />
          </section>
        </div>

        <div class="options-row">
          <label class="check"><input type="checkbox" v-model="forceUpdate" /><span>Force Update</span></label>
          <label class="check"><input type="checkbox" v-model="debug" /><span>Debug</span></label>
        </div>
      </div>

      <button class="execute-btn" :disabled="!cacheKey || executing" @click="executeJob">
        <span v-if="executing" class="btn-spinner"></span>
        {{ executing ? 'Running...' : 'Execute' }}
      </button>

      <p v-if="error" class="form-error">{{ error }}</p>

      <div v-if="pollStatus" class="poll-card">
        <JobStatusBadge :status="pollStatus.status" />
        <span class="mono poll-id">{{ pollStatus.job_id }}</span>
        <span v-if="pollStatus.status === 'pending' || pollStatus.status === 'running'" class="poll-label">
          {{ pollStatus.status === 'pending' ? 'Queued...' : 'Executing...' }}
        </span>
      </div>

      <div v-if="result" class="result-area">
        <div class="result-meta" v-if="result.execution_time_ms != null">
          Completed in <strong class="mono">{{ formatMs(result.execution_time_ms) }}</strong>
        </div>

        <div v-if="result.console_output" class="result-block">
          <h3 class="sub-h">Console</h3>
          <ConsoleOutput :output="result.console_output" />
        </div>

        <div v-if="resultBinary" class="result-block">
          <h3 class="sub-h">Binary Output</h3>
          <BinaryViewer :data="resultBinary" />
        </div>

        <div v-if="result.status === 'success' && result.result_data" class="result-block">
          <h3 class="sub-h">Output</h3>
          <JsonViewer :data="result.result_data" />
        </div>

        <div v-if="result.status === 'error'" class="result-block">
          <h3 class="sub-h">Error</h3>
          <div class="error-block">
            <p class="error-msg" v-if="result.error_message">{{ result.error_message }}</p>
            <pre class="error-stack" v-if="result.error_stack">{{ result.error_stack }}</pre>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '@/api/client.js';
import AppLayout from '@/components/AppLayout.vue';
import CodeEditor from '@/components/CodeEditor.vue';
import JobStatusBadge from '@/components/JobStatusBadge.vue';
import ConsoleOutput from '@/components/ConsoleOutput.vue';
import JsonViewer from '@/components/JsonViewer.vue';
import BinaryViewer from '@/components/BinaryViewer.vue';

const route = useRoute();
const DEFAULT_CODE = `module.exports = async function(input) {
  const items = input.items;

  // Your code here

  return items;
};`;

const CACHE_KEY_STORAGE = 'codeharbor_last_cache_key';
const savedCacheKey = localStorage.getItem(CACHE_KEY_STORAGE) || 'dashboard-cache';

const code = ref(DEFAULT_CODE);
const items = ref('[\n  \n]');
const cacheKey = ref(savedCacheKey);
const timeout = ref(60000);
const forceUpdate = ref(false);
const debug = ref(true);
const executing = ref(false);
const error = ref('');
const pollStatus = ref(null);
const result = ref(null);
let pollTimer = null;
let isReExecute = false;

onMounted(() => {
  if (route.query.code) code.value = route.query.code;
  if (route.query.items) items.value = route.query.items;
  if (route.query.cacheKey) {
    cacheKey.value = route.query.cacheKey;
    isReExecute = true;
  }
  if (route.query.options) { try { const o = JSON.parse(route.query.options); if (o.timeout) timeout.value = o.timeout; if (o.forceUpdate) forceUpdate.value = true; if (o.debug) debug.value = true; } catch {} }
});

watch(cacheKey, (val) => {
  if (!isReExecute && val) {
    localStorage.setItem(CACHE_KEY_STORAGE, val);
  }
  isReExecute = false;
});
onBeforeUnmount(() => { if (pollTimer) clearInterval(pollTimer); });

async function executeJob() {
  error.value = ''; result.value = null; pollStatus.value = null; executing.value = true;
  try {
    let parsedItems; try { parsedItems = JSON.parse(items.value); } catch { throw new Error('Invalid JSON in items'); }
    const options = { timeout: timeout.value }; if (forceUpdate.value) options.forceUpdate = true; if (debug.value) options.debug = true;
    const data = await api.post('/execute', { code: code.value, items: parsedItems, cacheKey: cacheKey.value, options });
    pollStatus.value = { job_id: data.jobId, status: 'pending' };
    startPolling(data.jobId);
  } catch (e) { error.value = e.message; executing.value = false; }
}

function startPolling(jobId) {
  pollTimer = setInterval(async () => {
    try {
      const data = await api.get(`/jobs/${jobId}/poll`);
      pollStatus.value = data;
      if (data.status === 'success' || data.status === 'error') { clearInterval(pollTimer); pollTimer = null; executing.value = false; result.value = data; pollStatus.value = null; }
    } catch { clearInterval(pollTimer); pollTimer = null; executing.value = false; error.value = 'Connection lost'; }
  }, 1000);
}

const resultBinary = computed(() => {
  if (!result.value?.result_data) return null;
  try {
    const parsed = typeof result.value.result_data === 'string' ? JSON.parse(result.value.result_data) : result.value.result_data;
    if (Array.isArray(parsed)) {
      const all = {};
      parsed.forEach((item, i) => {
        if (item?.binary && typeof item.binary === 'object') {
          Object.entries(item.binary).forEach(([k, v]) => { all[parsed.length > 1 ? `[${i}].${k}` : k] = v; });
        }
      });
      return Object.keys(all).length > 0 ? all : null;
    }
    if (parsed?.binary && typeof parsed.binary === 'object') return parsed.binary;
    return null;
  } catch { return null; }
});

function formatMs(ms) { if (ms == null) return '–'; if (ms < 1000) return `${Math.round(ms)}ms`; return `${(ms / 1000).toFixed(2)}s`; }
</script>

<style scoped>
.create-page { max-width: 860px; }
.page-heading { font-size: 22px; font-weight: 700; margin-bottom: 24px; letter-spacing: -0.02em; }

.form-stack { display: flex; flex-direction: column; gap: 18px; }
.field-group { display: flex; flex-direction: column; gap: 6px; }
.label { font-size: 12px; font-weight: 600; color: var(--text-secondary); letter-spacing: 0.02em; }
.req { color: var(--error); }

.input {
  padding: 8px 12px;
  background: var(--bg-raised);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-primary);
  font-size: 14px;
  outline: none;
  transition: border-color var(--duration);
  width: 100%;
}
.input:focus { border-color: var(--brand); box-shadow: 0 0 0 2px var(--brand-wash); }
.input::placeholder { color: var(--text-muted); }

.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

.options-row { display: flex; gap: 20px; }
.check { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-secondary); cursor: pointer; }
.check input[type="checkbox"] { accent-color: var(--brand); width: 15px; height: 15px; }

.execute-btn {
  display: inline-flex; align-items: center; gap: 8px;
  margin-top: 20px; padding: 10px 28px;
  background: var(--brand); border: none; border-radius: var(--radius);
  color: #fff; font-size: 14px; font-weight: 600;
  transition: background var(--duration);
}
.execute-btn:hover:not(:disabled) { background: var(--brand-light); }
.execute-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.form-error {
  color: var(--error); font-size: 13px; padding: 8px 12px; margin-top: 12px;
  background: rgba(255, 69, 58, 0.08); border-radius: var(--radius); border-left: 2px solid var(--error);
}

.poll-card {
  display: flex; align-items: center; gap: 10px;
  margin-top: 20px; padding: 14px 16px;
  border: 1px solid var(--border); border-radius: var(--radius);
  background: var(--bg-raised);
}
.poll-id { font-size: 12px; color: var(--text-muted); }
.poll-label { color: var(--text-secondary); font-size: 13px; }
.mono { font-family: var(--font-mono); }

.result-area { margin-top: 28px; }
.result-meta { font-size: 13px; color: var(--text-secondary); margin-bottom: 16px; }
.result-block { margin-bottom: 16px; }
.sub-h { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); margin-bottom: 8px; }

.error-block {
  background: rgba(255, 69, 58, 0.05); border: 1px solid rgba(255, 69, 58, 0.15);
  border-left: 3px solid var(--error); border-radius: var(--radius); padding: 14px;
}
.error-msg { color: var(--error); font-weight: 600; margin-bottom: 8px; font-size: 14px; }
.error-stack { font-family: var(--font-mono); font-size: 12px; color: var(--text-muted); white-space: pre-wrap; word-break: break-word; margin: 0; }
</style>
