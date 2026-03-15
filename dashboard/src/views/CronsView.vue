<template>
  <AppLayout>
    <div class="crons-page">
      <h1 class="page-heading">Scheduled Jobs</h1>

      <div class="coming-soon">
        <svg class="hero-icon" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="2" opacity="0.15"/>
          <circle cx="24" cy="24" r="20" stroke="currentColor" stroke-width="2" stroke-dasharray="6 4" opacity="0.3"/>
          <circle cx="24" cy="6" r="2.5" fill="currentColor" opacity="0.5"/>
          <line x1="24" y1="24" x2="24" y2="14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="24" y1="24" x2="32" y2="28" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
          <circle cx="24" cy="24" r="2" fill="currentColor"/>
        </svg>

        <h2 class="hero-title">Cron Executions</h2>

        <p class="hero-desc">
          Schedule recurring code executions using cron expressions.
          Set up jobs that run automatically at specified intervals — periodic data processing,
          scheduled report generation, automated monitoring, and more — all managed
          directly from the dashboard.
        </p>

        <div class="feature-list">
          <div class="feature">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" opacity="0.5"><path d="M8 1a7 7 0 110 14A7 7 0 018 1zm0 1.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM8 4a.75.75 0 01.75.75v3.5h2.5a.75.75 0 010 1.5h-3.25A.75.75 0 017.25 9V4.75A.75.75 0 018 4z"/></svg>
            <span>Cron expressions for flexible scheduling</span>
          </div>
          <div class="feature">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" opacity="0.5"><path d="M8 1a7 7 0 110 14A7 7 0 018 1zm3.5 5L7.25 10.25 4.5 7.5l1.06-1.06 1.69 1.69L10.44 4.94 11.5 6z"/></svg>
            <span>Configure code, inputs, and cache per schedule</span>
          </div>
          <div class="feature">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" opacity="0.5"><path d="M2.5 2A1.5 1.5 0 001 3.5v9A1.5 1.5 0 002.5 14h11a1.5 1.5 0 001.5-1.5v-9A1.5 1.5 0 0013.5 2h-11zM2.5 5h11v7.5h-11V5zM5 7h2v2H5V7zm4 0h2v2H9V7z"/></svg>
            <span>Pause, resume, and manage from the dashboard</span>
          </div>
          <div class="feature">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" opacity="0.5"><path d="M8 1a7 7 0 110 14A7 7 0 018 1zm0 1.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zm-.75 2h1.5v4h-1.5V4.5zm0 5.5h1.5V11.5h-1.5V10z"/></svg>
            <span>Full execution history for each scheduled job</span>
          </div>
        </div>

        <a
          href="https://github.com/BrOrlandi/CodeHarbor-Executor/issues/2"
          target="_blank"
          rel="noopener"
          class="interest-btn"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
          I'm interested in this feature
        </a>
      </div>
    </div>
  </AppLayout>
</template>

<script setup>
import AppLayout from '@/components/AppLayout.vue';
</script>

<style scoped>
.crons-page { max-width: 640px; }
.page-heading { font-size: 22px; font-weight: 700; margin-bottom: 32px; letter-spacing: -0.02em; }

.coming-soon {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 48px 24px;
}

.hero-icon {
  width: 64px;
  height: 64px;
  color: var(--brand);
  margin-bottom: 24px;
}

.hero-title {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 12px;
  letter-spacing: -0.01em;
}

.hero-desc {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.7;
  max-width: 480px;
  margin-bottom: 28px;
}

.feature-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;
  margin-bottom: 32px;
}

.feature {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}

.interest-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: var(--brand);
  border: none;
  border-radius: var(--radius);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition: background var(--duration);
}

.interest-btn:hover {
  background: var(--brand-light);
  color: #fff;
}
</style>
