<template>
  <div class="layout">
    <aside class="sidebar" :class="{ collapsed: sidebarCollapsed }">
      <div class="sidebar-header">
        <router-link to="/jobs" class="brand-link">
          <img src="/logo-notext.svg" alt="CodeHarbor" class="brand-icon" />
          <span class="brand-name" v-show="!sidebarCollapsed">CodeHarbor</span>
        </router-link>
        <button class="collapse-toggle" @click="sidebarCollapsed = !sidebarCollapsed" :aria-label="sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path :d="sidebarCollapsed ? 'M6 3l5 5-5 5' : 'M10 3L5 8l5 5'" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>

      <nav class="nav">
        <router-link to="/jobs" class="nav-link" active-class="active">
          <svg class="nav-svg" viewBox="0 0 20 20" fill="currentColor"><path d="M2 4.5A2.5 2.5 0 014.5 2h11A2.5 2.5 0 0118 4.5v11a2.5 2.5 0 01-2.5 2.5h-11A2.5 2.5 0 012 15.5v-11zM4.5 3.5a1 1 0 00-1 1v11a1 1 0 001 1h11a1 1 0 001-1v-11a1 1 0 00-1-1h-11zM5 7h10v1.5H5V7zm0 3.5h7V12H5v-1.5z"/></svg>
          <span class="nav-text" v-show="!sidebarCollapsed">Jobs</span>
        </router-link>
        <router-link to="/create" class="nav-link" active-class="active">
          <svg class="nav-svg" viewBox="0 0 20 20" fill="currentColor"><path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/></svg>
          <span class="nav-text" v-show="!sidebarCollapsed">Execute</span>
        </router-link>
        <router-link to="/cache" class="nav-link" active-class="active">
          <svg class="nav-svg" viewBox="0 0 20 20" fill="currentColor"><path d="M3 5a2 2 0 012-2h10a2 2 0 012 2v2a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm2-.5a.5.5 0 00-.5.5v2a.5.5 0 00.5.5h10a.5.5 0 00.5-.5V5a.5.5 0 00-.5-.5H5zM3 13a2 2 0 012-2h10a2 2 0 012 2v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2zm2-.5a.5.5 0 00-.5.5v2a.5.5 0 00.5.5h10a.5.5 0 00.5-.5v-2a.5.5 0 00-.5-.5H5z"/></svg>
          <span class="nav-text" v-show="!sidebarCollapsed">Cache</span>
        </router-link>
        <router-link to="/crons" class="nav-link" active-class="active">
          <svg class="nav-svg" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a8 8 0 110 16 8 8 0 010-16zm0 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM10.75 5v5h3.5v1.5h-5V5h1.5z"/></svg>
          <span class="nav-text" v-show="!sidebarCollapsed">Crons</span>
          <span class="chip-soon" v-show="!sidebarCollapsed">SOON</span>
        </router-link>
        <router-link to="/guide" class="nav-link" active-class="active">
          <svg class="nav-svg" viewBox="0 0 20 20" fill="currentColor"><path d="M3 4a2 2 0 012-2h7l5 5v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4zm2-.5a.5.5 0 00-.5.5v12a.5.5 0 00.5.5h10a.5.5 0 00.5-.5V7.5H12a.5.5 0 01-.5-.5V3.5H5zM13 4.2V6.5h2.3L13 4.2zM7 10h6v1.5H7V10zm0 3h4v1.5H7V13z"/></svg>
          <span class="nav-text" v-show="!sidebarCollapsed">Docs</span>
        </router-link>
        <router-link to="/docs" class="nav-link" active-class="active">
          <svg class="nav-svg" viewBox="0 0 20 20" fill="currentColor"><path d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2-.5a.5.5 0 00-.5.5v12a.5.5 0 00.5.5h8a.5.5 0 00.5-.5V4a.5.5 0 00-.5-.5H6zM7 7h6v1.5H7V7zm0 3h6v1.5H7V10zm0 3h4v1.5H7V13z"/></svg>
          <span class="nav-text" v-show="!sidebarCollapsed">API Docs</span>
        </router-link>
        <a href="https://www.npmjs.com/package/n8n-nodes-codeharbor" target="_blank" rel="noopener" class="nav-link">
          <svg class="nav-svg" viewBox="0 0 20 20" fill="currentColor"><path d="M2 2h16v16H2V2zm1.5 1.5v13h6.25V5.75h3.75v10.75H17.5V3.5H3.5z"/></svg>
          <span class="nav-text" v-show="!sidebarCollapsed">n8n Node</span>
        </a>
        <a href="https://chatgpt.com/g/g-67cfc39e08b0819188a8101656455aad-codeharbor-code-generator" target="_blank" rel="noopener" class="nav-link">
          <svg class="nav-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.998 5.998 0 0 0-3.998 2.9 6.047 6.047 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.612-1.5z"/></svg>
          <span class="nav-text" v-show="!sidebarCollapsed">ChatGPT Agent</span>
        </a>
      </nav>

      <div class="sidebar-bottom">
        <div class="sidebar-section">
          <a :href="GITHUB_REPO" target="_blank" rel="noopener" class="nav-link github-link">
            <svg class="nav-svg" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
            <span class="nav-text" v-show="!sidebarCollapsed">GitHub</span>
          </a>
        </div>
        <div class="sys-info" v-if="sysInfo && !sidebarCollapsed">
          <div class="sys-row">
            <a :href="releasesUrl" target="_blank" rel="noopener" class="sys-version" :title="'CodeHarbor v' + sysInfo.version">v{{ sysInfo.version }}</a>
          </div>
          <div class="sys-row" v-if="sysInfo.nodeVersion">
            <span class="sys-label">Node</span>
            <span class="sys-val">{{ sysInfo.nodeVersion }}</span>
          </div>
          <div class="sys-row" v-if="sysInfo.pnpmVersion">
            <span class="sys-label">pnpm</span>
            <span class="sys-val">{{ sysInfo.pnpmVersion }}</span>
          </div>
        </div>
        <div class="sidebar-section">
          <button class="nav-link logout" @click="handleLogout">
            <svg class="nav-svg" viewBox="0 0 20 20" fill="currentColor"><path d="M3 4.5A2.5 2.5 0 015.5 2H10v1.5H5.5a1 1 0 00-1 1v11a1 1 0 001 1H10V18H5.5A2.5 2.5 0 013 15.5v-11zM13.5 6L17 10l-3.5 4v-2.5H8v-3h5.5V6z"/></svg>
            <span class="nav-text" v-show="!sidebarCollapsed">Sign Out</span>
          </button>
        </div>
      </div>
    </aside>

    <main class="content">
      <slot />
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/api/client.js';

const GITHUB_REPO = 'https://github.com/BrOrlandi/CodeHarbor-Executor';
const releasesUrl = `${GITHUB_REPO}/releases`;

const router = useRouter();
const sidebarCollapsed = ref(false);
const sysInfo = ref(null);

onMounted(async () => {
  try { sysInfo.value = await api.get('/info'); } catch {}
});

async function handleLogout() {
  try { await api.post('/logout'); } catch {}
  router.push({ name: 'login' });
}
</script>

<style scoped>
.layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

.sidebar {
  width: 220px;
  flex-shrink: 0;
  background: var(--bg-raised);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  transition: width var(--duration) var(--ease-out);
  overflow: hidden;
}

.sidebar.collapsed {
  width: 56px;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 12px;
  height: 56px;
  border-bottom: 1px solid var(--border);
}

.brand-link {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  flex: 1;
  min-width: 0;
  text-decoration: none;
}

.brand-icon {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}

.brand-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.collapse-toggle {
  background: none;
  border: none;
  color: var(--text-muted);
  padding: 4px;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  transition: color var(--duration);
}

.collapse-toggle:hover {
  color: var(--text-secondary);
}

.nav {
  flex: 1;
  padding: 8px 8px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius);
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 13px;
  font-weight: 500;
  transition: color var(--duration), background var(--duration);
  white-space: nowrap;
  overflow: hidden;
  border: none;
  background: none;
  width: 100%;
  text-align: left;
  cursor: pointer;
}

.nav-link:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.nav-link.active {
  color: var(--brand);
  background: var(--brand-wash);
}

.nav-svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.nav-text {
  overflow: hidden;
  text-overflow: ellipsis;
}

.chip-soon {
  margin-left: auto;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--brand-wash-strong);
  color: var(--brand);
  line-height: 1.5;
  flex-shrink: 0;
}

.sidebar-bottom {
  border-top: 1px solid var(--border);
}

.sidebar-section {
  padding: 8px;
}

.sidebar-section + .sys-info,
.sys-info + .sidebar-section {
  border-top: 1px solid var(--border);
}

.sys-info {
  padding: 8px 10px 6px;
  margin-bottom: 2px;
}

.sys-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  line-height: 1.6;
}

.sys-version {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  color: var(--brand);
  text-decoration: none;
  transition: color var(--duration);
}

.sys-version:hover {
  color: var(--brand-light);
}

.sys-label {
  font-size: 11px;
  color: var(--text-muted);
}

.sys-val {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-secondary);
}

.logout:hover {
  color: var(--error);
  background: rgba(255, 69, 58, 0.08);
}

.content {
  flex: 1;
  overflow-y: auto;
  padding: clamp(20px, 3vw, 40px);
  background: var(--bg-base);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.content > :deep(*) {
  width: 100%;
  max-width: 1200px;
}

@media (max-width: 768px) {
  .sidebar {
    width: 56px;
  }
  .nav-text, .brand-name {
    display: none !important;
  }
  .collapse-toggle {
    display: none;
  }
}
</style>
