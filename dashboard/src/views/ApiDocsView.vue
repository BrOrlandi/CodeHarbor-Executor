<template>
  <AppLayout>
    <div class="docs-page">
      <iframe src="/api/docs" class="docs-frame" title="API Documentation" frameborder="0"></iframe>
    </div>
  </AppLayout>
</template>

<script setup>
import AppLayout from '@/components/AppLayout.vue';
</script>

<style scoped>
.docs-page {
  height: calc(100vh - 64px);
  margin: -20px;
  margin: calc(-1 * clamp(20px, 3vw, 40px));
}
.docs-frame { width: 100%; height: 100%; border: none; background: #fff; }
</style>
