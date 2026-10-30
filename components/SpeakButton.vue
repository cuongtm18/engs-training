<script setup lang="ts">
const props = withDefaults(defineProps<{ text: string; id?: string }>(), { id: undefined })
const { supported, speakingId, toggle } = useSpeak()

const key = computed(() => props.id ?? props.text)
const on = computed(() => speakingId.value === key.value)
</script>

<template>
  <button
    class="speak"
    :class="{ on }"
    :disabled="!supported"
    :aria-pressed="on"
    :aria-label="on ? 'Stop listening' : 'Listen'"
    :title="supported ? undefined : 'Speech is not supported on this device'"
    @click="toggle(key, text)"
  >
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <path class="w1" d="M15.5 8.5a5 5 0 010 7" />
      <path class="w2" d="M18.5 5.5a9 9 0 010 13" />
    </svg>
  </button>
</template>

<style scoped>
.speak { position: relative; flex: none; appearance: none; width: 44px; height: 44px; padding: 0; border-radius: 50%; border: 1px solid var(--line); background: var(--card); color: var(--ink); display: grid; place-items: center; cursor: pointer; transition: transform .1s, background .2s, color .2s, border-color .2s; }
.speak:active { transform: scale(.92); }
.speak:disabled { opacity: .4; cursor: default; }
.speak svg { display: block; }

/* playing: tinted button, glowing ring and animated sound waves */
.speak.on { color: var(--accent); border-color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, var(--card)); }
.speak.on::after { content: ''; position: absolute; inset: -1px; border-radius: 50%; border: 2px solid var(--accent); opacity: 0; animation: ring 1.2s ease-out infinite; pointer-events: none; }
.speak.on .w1 { animation: wave 1s ease-in-out infinite; }
.speak.on .w2 { animation: wave 1s ease-in-out .25s infinite; }
@keyframes wave { 0%, 100% { opacity: .25; } 50% { opacity: 1; } }
@keyframes ring { 0% { transform: scale(1); opacity: .55; } 100% { transform: scale(1.45); opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .speak.on::after, .speak.on .w1, .speak.on .w2 { animation: none; }
  .speak.on::after { opacity: .5; }
}
</style>
