<script setup lang="ts">
const toasts = useUndoState()
const undo = useUndo()

const paused = ref<Record<number, boolean>>({})
const hold = (id: number, v: boolean) => (paused.value[id] = v)
</script>

<template>
  <Teleport to="body">
    <div class="host" aria-live="polite" aria-atomic="false">
      <TransitionGroup name="toast" tag="div" class="stack">
        <div
          v-for="t in toasts"
          :key="t.id"
          class="toast"
          role="status"
          @pointerenter="hold(t.id, true)"
          @pointerleave="hold(t.id, false)"
          @touchstart.passive="hold(t.id, true)"
          @touchend="hold(t.id, false)"
          @touchcancel="hold(t.id, false)"
        >
          <span class="msg">{{ t.message }}</span>
          <button v-if="t.undo" class="undo" :disabled="!t.armed" @click="undo.run(t.id)">Undo</button>
          <button class="close" aria-label="Dismiss" @click="undo.dismiss(t.id)"><AppIcon name="x" :size="16" /></button>
          <i class="timer" :class="{ hold: paused[t.id] }" :style="{ animationDuration: t.duration + 'ms' }" @animationend="undo.dismiss(t.id)" />
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
/* Top of the screen, below the navigation bar, so the toast is away from where the thumb just tapped. */
.host { position: fixed; z-index: 80; left: 0; right: 0; top: calc(env(safe-area-inset-top, 0px) + 66px); transform: translate3d(0, var(--vv-top, 0px), 0); display: flex; justify-content: center; pointer-events: none; padding: 0 12px; }
.stack { position: relative; width: 100%; max-width: 520px; display: flex; flex-direction: column; gap: 8px; }
.toast { position: relative; overflow: hidden; pointer-events: auto; display: flex; align-items: center; gap: 4px; padding: 4px 4px 4px 16px; min-height: 52px; border-radius: 18px; background: var(--ink); color: var(--bg); box-shadow: 0 10px 30px rgba(0, 0, 0, .28); }
.msg { flex: 1; min-width: 0; font-weight: 600; font-size: .95rem; line-height: 1.25; padding: 6px 0; }
.undo { appearance: none; border: 0; border-radius: 12px; min-height: 44px; padding: 0 14px; background: transparent; color: color-mix(in srgb, var(--accent) 85%, #fff); font: inherit; font-weight: 750; cursor: pointer; transition: opacity .15s, background .15s; }
.undo:not(:disabled):active { background: rgba(255, 255, 255, .14); }
.undo:disabled { opacity: .4; cursor: default; }
.close { appearance: none; border: 0; width: 44px; height: 44px; border-radius: 12px; background: transparent; color: color-mix(in srgb, var(--bg) 70%, transparent); display: grid; place-items: center; padding: 0; cursor: pointer; }
.timer { position: absolute; left: 0; bottom: 0; height: 3px; width: 100%; background: var(--accent); transform-origin: left; animation: shrink linear forwards; }
.timer.hold { animation-play-state: paused; }
@keyframes shrink { from { transform: scaleX(1); } to { transform: scaleX(0); } }
.toast-enter-active, .toast-leave-active { transition: transform .26s cubic-bezier(.2, .8, .2, 1), opacity .2s; }
.toast-enter-from { transform: translateY(-14px); opacity: 0; }
.toast-leave-to { transform: translateY(-10px); opacity: 0; }
.toast-leave-active { position: absolute; left: 0; right: 0; }
@media (prefers-reduced-motion: reduce) { .toast-enter-active, .toast-leave-active { transition: opacity .01s; } .toast-enter-from, .toast-leave-to { transform: none; } }
</style>
