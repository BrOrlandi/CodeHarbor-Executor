<template>
  <div class="binaries" v-if="entries.length > 0">
    <div v-for="entry in entries" :key="entry.key" class="binary-item">
      <div class="binary-header">
        <span class="binary-name">{{ entry.fileName }}</span>
        <span class="binary-meta">{{ entry.key }} &middot; {{ entry.mimeType }} &middot; {{ formatSize(entry.size) }}</span>
      </div>

      <div class="binary-preview">
        <!-- Image -->
        <img
          v-if="entry.category === 'image'"
          :src="entry.dataUrl"
          :alt="entry.fileName"
          class="preview-image"
        />

        <!-- Audio -->
        <audio
          v-else-if="entry.category === 'audio'"
          :src="entry.dataUrl"
          controls
          class="preview-audio"
        ></audio>

        <!-- Video -->
        <video
          v-else-if="entry.category === 'video'"
          :src="entry.dataUrl"
          controls
          class="preview-video"
        ></video>

        <!-- PDF -->
        <iframe
          v-else-if="entry.mimeType === 'application/pdf'"
          :src="entry.dataUrl"
          class="preview-pdf"
          title="PDF preview"
        ></iframe>

        <!-- Other: download button -->
        <div v-else class="preview-download">
          <svg class="download-icon" viewBox="0 0 20 20" fill="currentColor"><path d="M10 3a1 1 0 011 1v7.586l2.293-2.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 11.586V4a1 1 0 011-1zM4 16a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1z"/></svg>
          <span class="download-text">{{ entry.mimeType }}</span>
        </div>
      </div>

      <a :href="entry.dataUrl" :download="entry.fileName" class="download-btn">
        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M10 3a1 1 0 011 1v7.586l2.293-2.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 11.586V4a1 1 0 011-1zM4 16a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1z"/></svg>
        Download
      </a>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  data: {
    type: [String, Object],
    required: true,
  },
});

function getCategory(mimeType) {
  if (!mimeType) return 'other';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  return 'other';
}

function formatSize(bytes) {
  if (bytes == null || bytes === 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

const entries = computed(() => {
  let binary = props.data;
  if (typeof binary === 'string') {
    try { binary = JSON.parse(binary); } catch { return []; }
  }
  if (!binary || typeof binary !== 'object') return [];

  return Object.entries(binary).map(([key, val]) => {
    if (!val || !val.data) return null;
    const mimeType = val.mimeType || 'application/octet-stream';
    const dataUrl = `data:${mimeType};base64,${val.data}`;
    const size = Math.round((val.data.length * 3) / 4);
    return {
      key,
      fileName: val.fileName || key,
      mimeType,
      dataUrl,
      size,
      category: getCategory(mimeType),
    };
  }).filter(Boolean);
});
</script>

<style scoped>
.binaries {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.binary-item {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.binary-header {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 10px 14px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
}

.binary-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.binary-meta {
  font-size: 11px;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.binary-preview {
  padding: 16px;
  background: var(--bg-inset);
  display: flex;
  justify-content: center;
}

.preview-image {
  max-width: 100%;
  max-height: 480px;
  border-radius: var(--radius-sm);
  object-fit: contain;
}

.preview-audio {
  width: 100%;
  max-width: 500px;
  height: 40px;
  border-radius: var(--radius-sm);
}

.preview-video {
  max-width: 100%;
  max-height: 480px;
  border-radius: var(--radius-sm);
}

.preview-pdf {
  width: 100%;
  height: 500px;
  border: none;
  border-radius: var(--radius-sm);
  background: #fff;
}

.preview-download {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px;
  color: var(--text-muted);
}

.download-icon {
  width: 32px;
  height: 32px;
  opacity: 0.4;
}

.download-text {
  font-size: 12px;
  font-family: var(--font-mono);
}

.download-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  margin: 10px 14px 12px;
  background: none;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  text-decoration: none;
  transition: all 200ms;
  width: fit-content;
}

.download-btn:hover {
  color: var(--brand);
  border-color: var(--brand-dim);
  background: var(--brand-wash);
}
</style>
