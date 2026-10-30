<script setup lang="ts">
const props = defineProps<{ modelValue: boolean; title?: string; tall?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const dragY = ref(0)
let startY = 0
let dragging = false

const close = () => emit('update:modelValue', false)

function onStart(e: TouchEvent) {
  startY = e.touches[0]!.clientY
  dragging = true
}
function onMove(e: TouchEvent) {
  if (!dragging) return
  dragY.value = Math.max(0, e.touches[0]!.clientY - startY)
}
function onEnd() {
  dragging = false
  if (dragY.value > 110) close()
  dragY.value = 0
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.modelValue) close()
}

watch(
  () => props.modelValue,
  (open) => {
    if (!import.meta.client) return
    document.documentElement.style.overflow = open ? 'hidden' : ''
    if (open) haptic(8)
  },
)
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.documentElement.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="modelValue" class="sheet-root" role="dialog" aria-modal="true" :aria-label="title">
        <div class="backdrop" @click="close" />
        <div class="panel" :class="{ tall }" :style="dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined">
          <div class="grab" @touchstart.passive="onStart" @touchmove.passive="onMove" @touchend="onEnd">
            <i />
            <div class="bar">
              <button class="x" aria-label="Close" @click="close"><AppIcon name="x" :size="16" /></button>
              <b class="ttl">{{ title }}</b>
              <span class="x ph" />
            </div>
          </div>
          <div class="body"><slot /></div>
          <div v-if="$slots.footer" class="foot"><slot name="footer" /></div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sheet-root { position: fixed; inset: 0; z-index: 50; display: flex; align-items: flex-end; justify-content: center; }
.backdrop { position: absolute; inset: 0; background: rgba(20, 12, 4, .45); backdrop-filter: blur(2px); }
.panel { position: relative; width: 100%; max-width: 560px; max-height: 92dvh; display: flex; flex-direction: column; background: var(--bg); border-radius: 26px 26px 0 0; box-shadow: 0 -10px 40px rgba(0, 0, 0, .25); transition: transform .28s cubic-bezier(.2, .8, .2, 1); }
.panel.tall { height: 92dvh; }
.grab { padding: 8px 12px 4px; touch-action: none; }
.grab > i { display: block; width: 38px; height: 5px; border-radius: 9px; background: var(--line); margin: 0 auto 6px; }
.bar { display: flex; align-items: center; justify-content: space-between; min-height: 44px; }
.ttl { font-size: 1.05rem; }
.x { width: 44px; height: 44px; border-radius: 50%; border: 0; background: var(--soft); color: var(--ink); font: inherit; cursor: pointer; display: grid; place-items: center; padding: 0; }
.x.ph { visibility: hidden; }
.body > * { flex: none; }
.body { overflow-y: auto; padding: 8px 16px 16px; display: flex; flex-direction: column; gap: 12px; overscroll-behavior: contain; }
.foot { padding: 10px 16px calc(14px + env(safe-area-inset-bottom)); border-top: 1px solid var(--line); background: var(--bg); }
.sheet-enter-active, .sheet-leave-active { transition: opacity .22s; }
.sheet-enter-active .panel, .sheet-leave-active .panel { transition: transform .28s cubic-bezier(.2, .8, .2, 1); }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
.sheet-enter-from .panel, .sheet-leave-to .panel { transform: translateY(100%); }
</style>
