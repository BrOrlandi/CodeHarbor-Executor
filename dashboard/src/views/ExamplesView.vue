<template>
  <AppLayout>
    <div class="examples-page">
      <div class="docs-tabs">
        <router-link to="/guide" class="tab" :class="{ active: $route.name === 'guide' }">Documentation</router-link>
        <router-link to="/examples" class="tab" :class="{ active: $route.name === 'examples' }">Examples</router-link>
      </div>

      <h1 class="page-heading">Interactive Examples</h1>
      <p class="page-desc">Try these examples directly in the dashboard. Click "Run this example" to execute each one.</p>

      <div class="example-list">
        <div v-for="ex in examples" :key="ex.id" class="example-card">
          <div class="example-header">
            <div>
              <h2 class="example-title">{{ ex.title }}</h2>
              <p class="example-desc">{{ ex.description }}</p>
            </div>
            <button class="run-btn" @click="runExample(ex)">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2l10 6-10 6V2z"/></svg>
              Run
            </button>
          </div>

          <div class="example-code">
            <CodeViewer :code="ex.code" language="javascript" />
          </div>

          <div class="example-input">
            <span class="input-label">Input</span>
            <code class="input-preview">{{ JSON.stringify(ex.items).slice(0, 120) }}{{ JSON.stringify(ex.items).length > 120 ? '...' : '' }}</code>
          </div>

          <div v-if="results[ex.id]" class="example-result">
            <div v-if="results[ex.id].loading" class="result-loading">
              <span class="spinner"></span> Running...
            </div>
            <div v-else-if="results[ex.id].error" class="result-error">
              {{ results[ex.id].error }}
            </div>
            <div v-else-if="results[ex.id].data" class="result-done">
              <div class="result-meta">
                <JobStatusBadge :status="results[ex.id].data.status" />
                <span class="mono result-time" v-if="results[ex.id].data.execution_time_ms">
                  {{ formatMs(results[ex.id].data.execution_time_ms) }}
                </span>
              </div>

              <div v-if="resultBinary(results[ex.id].data)" class="result-section">
                <BinaryViewer :data="resultBinary(results[ex.id].data)" />
              </div>

              <div v-if="results[ex.id].data.console_output" class="result-section">
                <ConsoleOutput :output="results[ex.id].data.console_output" />
              </div>

              <div v-if="results[ex.id].data.result_data" class="result-section">
                <JsonViewer :data="results[ex.id].data.result_data" :initial-expanded="false" />
              </div>

              <router-link
                :to="{ name: 'job-detail', params: { jobId: results[ex.id].data.job_id } }"
                class="view-job-link"
              >View full job details</router-link>
            </div>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import { reactive } from 'vue';
import { api } from '@/api/client.js';
import { examples } from '@/data/examples.js';
import AppLayout from '@/components/AppLayout.vue';
import CodeViewer from '@/components/CodeViewer.vue';
import JobStatusBadge from '@/components/JobStatusBadge.vue';
import ConsoleOutput from '@/components/ConsoleOutput.vue';
import JsonViewer from '@/components/JsonViewer.vue';
import BinaryViewer from '@/components/BinaryViewer.vue';

const results = reactive({});

function formatMs(ms) {
  if (ms == null) return '';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function resultBinary(jobData) {
  if (!jobData?.result_data) return null;
  try {
    const parsed = typeof jobData.result_data === 'string' ? JSON.parse(jobData.result_data) : jobData.result_data;
    if (Array.isArray(parsed)) {
      const all = {};
      parsed.forEach((item, i) => {
        if (item?.binary && typeof item.binary === 'object') {
          Object.entries(item.binary).forEach(([k, v]) => { all[parsed.length > 1 ? `[${i}].${k}` : k] = v; });
        }
      });
      return Object.keys(all).length > 0 ? all : null;
    }
    if (parsed?.binary) return parsed.binary;
    return null;
  } catch { return null; }
}

async function runExample(ex) {
  results[ex.id] = { loading: true, data: null, error: null };

  try {
    const submitRes = await api.post('/execute', {
      code: ex.code,
      items: ex.items,
      cacheKey: ex.cacheKey,
      options: { debug: true },
    });

    const jobId = submitRes.jobId;

    // Poll until done
    const poll = async () => {
      const data = await api.get(`/jobs/${jobId}/poll`);
      if (data.status === 'success' || data.status === 'error') {
        results[ex.id] = { loading: false, data, error: null };
      } else {
        setTimeout(poll, 1000);
      }
    };
    poll();
  } catch (e) {
    results[ex.id] = { loading: false, data: null, error: e.message };
  }
}
</script>

<style scoped>
.examples-page { max-width: 860px; }

.docs-tabs {
  display: flex;
  gap: 2px;
  margin-bottom: 28px;
  border-bottom: 1px solid var(--border);
}

.tab {
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  text-decoration: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color var(--duration), border-color var(--duration);
}

.tab:hover { color: var(--text-primary); }
.tab.active { color: var(--brand); border-bottom-color: var(--brand); }

.page-heading { font-size: 22px; font-weight: 700; margin-bottom: 6px; letter-spacing: -0.02em; }
.page-desc { color: var(--text-secondary); font-size: 14px; margin-bottom: 28px; }

.example-list { display: flex; flex-direction: column; gap: 20px; }

.example-card {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.example-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px;
  background: var(--bg-raised);
}

.example-title { font-size: 15px; font-weight: 600; margin-bottom: 2px; }
.example-desc { font-size: 13px; color: var(--text-muted); }

.run-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  background: var(--brand);
  border: none;
  border-radius: var(--radius);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background var(--duration);
}

.run-btn:hover { background: var(--brand-light); }

.example-code {
  border-top: 1px solid var(--border);
}

.example-code :deep(.viewer) {
  border: none;
  border-radius: 0;
}

.example-input {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 18px;
  background: var(--bg-surface);
  border-top: 1px solid var(--border);
  font-size: 12px;
}

.input-label {
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  flex-shrink: 0;
}

.input-preview {
  font-family: var(--font-mono);
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: none;
  padding: 0;
}

.example-result {
  border-top: 1px solid var(--border);
  padding: 16px 18px;
}

.result-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 13px;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--border);
  border-top-color: var(--brand);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.result-error {
  color: var(--error);
  font-size: 13px;
  padding: 8px 12px;
  background: rgba(255, 69, 58, 0.08);
  border-radius: var(--radius);
  border-left: 2px solid var(--error);
}

.result-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.result-time { font-size: 12px; color: var(--text-muted); }
.mono { font-family: var(--font-mono); }

.result-section { margin-bottom: 12px; }

.view-job-link {
  font-size: 12px;
  color: var(--brand);
  font-weight: 500;
}

.view-job-link:hover { color: var(--brand-light); }

.result-done :deep(.viewer),
.result-done :deep(.console),
.result-done :deep(.json-wrap),
.result-done :deep(.binaries) {
  font-size: 12px;
}
</style>
