<template>
  <div class="editor" ref="editorContainer"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { bracketMatching, indentOnInput } from '@codemirror/language';

const props = defineProps({
  modelValue: { type: String, default: '' },
  language: { type: String, default: 'javascript', validator: (v) => ['javascript', 'json'].includes(v) },
});

const emit = defineEmits(['update:modelValue']);
const editorContainer = ref(null);
let view = null;
let ignoreNextUpdate = false;

function createState(doc) {
  return EditorState.create({
    doc,
    extensions: [
      props.language === 'json' ? json() : javascript(),
      oneDark, lineNumbers(), highlightActiveLine(), highlightActiveLineGutter(),
      history(), bracketMatching(), indentOnInput(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      EditorView.lineWrapping,
      EditorView.updateListener.of((u) => { if (u.docChanged) { ignoreNextUpdate = true; emit('update:modelValue', u.state.doc.toString()); } }),
      EditorView.theme({ '&': { fontSize: '13px', minHeight: '180px' }, '.cm-scroller': { overflow: 'auto' }, '.cm-content': { minHeight: '180px' } }),
    ],
  });
}

onMounted(() => { view = new EditorView({ state: createState(props.modelValue), parent: editorContainer.value }); });
watch(() => props.modelValue, (v) => { if (ignoreNextUpdate) { ignoreNextUpdate = false; return; } if (view && view.state.doc.toString() !== v) view.setState(createState(v)); });
onBeforeUnmount(() => { if (view) { view.destroy(); view = null; } });
</script>

<style scoped>
.editor { border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
.editor :deep(.cm-editor) { border-radius: var(--radius); }
.editor :deep(.cm-editor.cm-focused) { outline: 1px solid var(--brand-dim); }
</style>
