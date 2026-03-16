<template>
  <AppLayout>
    <div class="settings-page">
      <h1 class="page-heading">Settings</h1>

      <div v-if="loading" class="loading">Loading...</div>

      <template v-if="settings">
        <div v-for="group in settingsGroups" :key="group.label" class="settings-group">
          <h2 class="group-heading">{{ group.label }}</h2>
          <div class="table-wrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th>Variable</th>
                  <th>Value</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in group.rows" :key="row.variable" class="tbl-row">
                  <td class="mono cell-var">{{ row.variable }}</td>
                  <td class="mono cell-val">{{ row.value }}</td>
                  <td class="cell-desc">{{ row.description }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>

      <div v-if="error" class="error">{{ error }}</div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import AppLayout from '@/components/AppLayout.vue';
import { api } from '@/api/client.js';

const settings = ref(null);
const loading = ref(true);
const error = ref(null);

onMounted(async () => {
  try {
    settings.value = await api.get('/settings');
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
});

const settingsGroups = computed(() => {
  if (!settings.value) return [];
  const s = settings.value;

  return [
    {
      label: 'Server',
      rows: [
        { variable: 'PORT', value: s.port, description: 'The port on which the service runs' },
        { variable: 'SECRET_KEY', value: s.secretKey ? 'Set' : 'Not set', description: 'Authentication token for API calls and dashboard login' },
        { variable: 'DATA_DIR', value: s.dataDir, description: 'Root directory for all persistent data (database, cache, executions)' },
      ],
    },
    {
      label: 'Execution',
      rows: [
        { variable: 'DEFAULT_TIMEOUT', value: `${s.defaultTimeout}ms`, description: 'Default execution timeout in milliseconds' },
        { variable: 'EXECUTIONS_DATA_PRUNE_MAX_COUNT', value: s.executionsDataPruneMaxCount, description: 'Maximum number of execution directories and job records to keep' },
        { variable: 'DEPENDENCY_VERSION_STRATEGY', value: s.dependencyVersionStrategy, description: 'How dependency versions are resolved (update or pinned)' },
      ],
    },
    {
      label: 'Cache',
      rows: [
        { variable: 'CACHE_SIZE_LIMIT', value: s.cacheSizeLimitFormatted, description: 'Maximum cache directory size' },
      ],
    },
    {
      label: 'Dashboard',
      rows: [
        { variable: 'DASHBOARD_ENABLED', value: s.dashboardEnabled ? 'true' : 'false', description: 'Enable or disable the web dashboard' },
      ],
    },
    {
      label: 'System',
      rows: [
        { variable: 'Version', value: `v${s.version}`, description: 'CodeHarbor Executor version' },
        { variable: 'Node.js', value: s.nodeVersion, description: 'Node.js runtime version' },
        { variable: 'pnpm', value: s.pnpmVersion || 'N/A', description: 'pnpm package manager version' },
      ],
    },
  ];
});
</script>

<style scoped>
.settings-page {
  width: 100%;
}

.page-heading {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 24px;
  color: var(--text-primary);
}

.settings-group {
  margin-bottom: 28px;
}

.group-heading {
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  margin-bottom: 10px;
}

.table-wrap {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.tbl {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.tbl thead th {
  background: var(--bg-raised);
  padding: 8px 12px;
  text-align: left;
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
}

.tbl-row td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}

.tbl-row:last-child td {
  border-bottom: none;
}

.mono {
  font-family: var(--font-mono);
}

.cell-var {
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  width: 1%;
}

.cell-val {
  color: var(--brand);
  white-space: nowrap;
  width: 1%;
}

.cell-desc {
  color: var(--text-secondary);
}

.loading {
  color: var(--text-muted);
  padding: 40px 0;
  text-align: center;
}

.error {
  color: var(--error);
  padding: 20px 0;
}
</style>
