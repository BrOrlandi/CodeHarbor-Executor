<template>
  <div class="viewer" ref="editorContainer"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';

const props = defineProps({
  code: { type: String, default: '' },
  language: { type: String, default: 'javascript', validator: (v) => ['javascript', 'json'].includes(v) },
});

const editorContainer = ref(null);
let view = null;

function createState(doc) {
  return EditorState.create({
    doc,
    extensions: [
      props.language === 'json' ? json() : javascript(),
      oneDark,
      EditorView.editable.of(false),
      EditorState.readOnly.of(true),
      EditorView.lineWrapping,
      EditorView.theme({ '&': { fontSize: '13px', maxHeight: '500px' }, '.cm-scroller': { overflow: 'auto' } }),
    ],
  });
}

onMounted(() => { view = new EditorView({ state: createState(props.code), parent: editorContainer.value }); });
watch(() => props.code, (c) => { if (view) view.setState(createState(c)); });
onBeforeUnmount(() => { if (view) { view.destroy(); view = null; } });
</script>

<style scoped>
.viewer { border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
.viewer :deep(.cm-editor) { border-radius: var(--radius); }
</style>
