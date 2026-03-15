<template>
  <AppLayout>
    <div class="docs-page">
      <div class="docs-tabs">
        <router-link to="/guide" class="tab" :class="{ active: $route.name === 'guide' }">Documentation</router-link>
        <router-link to="/examples" class="tab" :class="{ active: $route.name === 'examples' }">Examples</router-link>
      </div>
      <article class="md-body" v-html="renderedMarkdown"></article>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { marked } from 'marked';
import AppLayout from '@/components/AppLayout.vue';
import readmeRaw from '../../docs/README.md?raw';

const renderedMarkdown = ref('');

onMounted(() => {
  // Rewrite relative image paths to serve from /dashboard/images/
  const processed = readmeRaw.replace(/\.\/(images\/)/g, import.meta.env.BASE_URL + '$1');
  renderedMarkdown.value = marked.parse(processed);
});
</script>

<style scoped>
.docs-page {
  max-width: 860px;
}

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

.tab:hover {
  color: var(--text-primary);
}

.tab.active {
  color: var(--brand);
  border-bottom-color: var(--brand);
}

.md-body {
  line-height: 1.7;
  color: var(--text-primary);
}

.md-body :deep(h1) {
  font-size: 24px;
  font-weight: 700;
  margin: 32px 0 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
  letter-spacing: -0.02em;
}

.md-body :deep(h1:first-child) {
  margin-top: 0;
}

.md-body :deep(h2) {
  font-size: 18px;
  font-weight: 700;
  margin: 28px 0 12px;
  letter-spacing: -0.01em;
}

.md-body :deep(h3) {
  font-size: 15px;
  font-weight: 600;
  margin: 20px 0 8px;
}

.md-body :deep(p) {
  margin: 0 0 14px;
  color: var(--text-secondary);
}

.md-body :deep(a) {
  color: var(--brand);
}

.md-body :deep(a:hover) {
  color: var(--brand-light);
}

.md-body :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.88em;
  background: var(--bg-surface);
  padding: 2px 6px;
  border-radius: 3px;
  color: var(--text-primary);
}

.md-body :deep(pre) {
  background: var(--bg-inset);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 16px;
  margin: 0 0 16px;
  overflow-x: auto;
}

.md-body :deep(pre code) {
  background: none;
  padding: 0;
  font-size: 13px;
  line-height: 1.5;
}

.md-body :deep(ul),
.md-body :deep(ol) {
  margin: 0 0 14px;
  padding-left: 24px;
  color: var(--text-secondary);
}

.md-body :deep(li) {
  margin-bottom: 4px;
}

.md-body :deep(blockquote) {
  border-left: 3px solid var(--brand);
  margin: 0 0 14px;
  padding: 8px 16px;
  color: var(--text-secondary);
  background: var(--brand-wash);
  border-radius: 0 var(--radius) var(--radius) 0;
}

.md-body :deep(strong) {
  color: var(--text-primary);
}

.md-body :deep(hr) {
  border: none;
  border-top: 1px solid var(--border);
  margin: 24px 0;
}

.md-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 0 0 16px;
  font-size: 13px;
}

.md-body :deep(th) {
  text-align: left;
  padding: 8px 12px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  font-weight: 600;
  color: var(--text-secondary);
}

.md-body :deep(td) {
  padding: 8px 12px;
  border: 1px solid var(--border);
  color: var(--text-secondary);
}

.md-body :deep(img) {
  max-width: 100%;
  border-radius: var(--radius);
}

.md-body :deep(div[align="center"]) {
  text-align: center;
  margin: 16px 0;
}
</style>
