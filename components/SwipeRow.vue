<script setup lang="ts">
// Vuốt sang trái để hiện nút hành động (kiểu iOS).
const props = withDefaults(defineProps<{ label?: string; disabled?: boolean }>(), { label: 'Delete' })
const emit = defineEmits<{ action: [] }>()

const W = 92
const x = ref(0)
const animate = ref(true)
let startX = 0
let startY = 0
let base = 0
let locked: 'h' | 'v' | null = null

function onStart(e: TouchEvent) {
  if (props.disabled) return
  startX = e.touches[0]!.clientX
  startY = e.touches[0]!.clientY
  base = x.value
  locked = null
  animate.value = false
}
function onMove(e: TouchEvent) {
  if (props.disabled) return
  const dx = e.touches[0]!.clientX - startX
  const dy = e.touches[0]!.clientY - startY
  if (!locked) locked = Math.abs(dx) > Math.abs(dy) + 4 ? 'h' : Math.abs(dy) > 8 ? 'v' : null
  if (locked !== 'h') return
  x.value = Math.min(0, Math.max(-W - 24, base + dx))
}
function onEnd() {
  animate.value = true
  if (locked === 'h') x.value = x.value < -W / 2 ? -W : 0
}
function fire() {
  x.value = 0
  emit('action')
}
</script>

<template>
  <div class="swipe">
    <button v-if="!disabled" class="act" :style="{ width: W + 'px' }" tabindex="-1" @click="fire">{{ label }}</button>
    <div class="row-in" :class="{ anim: animate }" :style="{ transform: `translateX(${x}px)` }" @touchstart.passive="onStart" @touchmove.passive="onMove" @touchend="onEnd" @touchcancel="onEnd" @click="x !== 0 && (x = 0)">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.swipe { position: relative; overflow: hidden; border-radius: 20px; }
.act { position: absolute; top: 0; right: 0; bottom: 0; border: 0; background: var(--bad); color: #fff; font: inherit; font-weight: 700; cursor: pointer; }
.row-in { position: relative; touch-action: pan-y; }
.row-in.anim { transition: transform .25s cubic-bezier(.2, .8, .2, 1); }
</style>
