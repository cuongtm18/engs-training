<script setup lang="ts">
// Icon SVG căn tâm chính xác, thay cho ký tự văn bản (＋ ✎ ‹ ▶ …) vốn hay bị lệch.
const props = withDefaults(defineProps<{ name: keyof typeof PATHS; size?: number; stroke?: number }>(), { size: 20, stroke: 2.2 })

const PATHS = {
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  check: 'M5 13l4 4L19 7',
  chat: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
  send: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
  lock: 'M7 11V8a5 5 0 0110 0v3M6 11h12a1 1 0 011 1v8a1 1 0 01-1 1H6a1 1 0 01-1-1v-8a1 1 0 011-1z',
  x: 'M18 6L6 18M6 6l12 12',
  'chevron-left': 'M15 18l-6-6 6-6',
  edit: 'M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z',
  repeat: 'M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3',
  volume: 'M11 5L6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13',
  play: 'M8 5.2v13.6a.6.6 0 00.9.5l11-6.8a.6.6 0 000-1L8.9 4.7a.6.6 0 00-.9.5z',
} as const
const filled = computed(() => props.name === 'play')
</script>

<template>
  <svg :width="size" :height="size" viewBox="0 0 24 24" :fill="filled ? 'currentColor' : 'none'" :stroke="filled ? 'none' : 'currentColor'" :stroke-width="stroke" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" style="display: block; flex: none">
    <path :d="PATHS[name]" />
  </svg>
</template>
