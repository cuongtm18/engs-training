<script setup lang="ts">
const c = useConfirmState()
function answer(v: boolean) {
  c.open = false
  c.resolve?.(v)
  c.resolve = undefined
}
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="c.open" class="root" role="alertdialog" aria-modal="true" @keydown.esc="answer(false)">
        <div class="backdrop" @click="answer(false)" />
        <div class="stack">
          <div class="group">
            <div class="info">
              <b>{{ c.title }}</b>
              <span v-if="c.message" class="muted">{{ c.message }}</span>
            </div>
            <button class="act" :class="{ danger: c.destructive }" @click="answer(true)">{{ c.confirmText }}</button>
          </div>
          <button class="group cancel" @click="answer(false)">Cancel</button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.root { position: fixed; inset: 0; z-index: 60; display: flex; align-items: flex-end; justify-content: center; }
.backdrop { position: absolute; inset: 0; background: rgba(20, 12, 4, .45); }
.stack { position: relative; width: 100%; max-width: 560px; padding: 12px 12px calc(12px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 8px; transition: transform .26s cubic-bezier(.2, .8, .2, 1); }
.group { background: var(--card); border-radius: 18px; overflow: hidden; border: 0; width: 100%; display: flex; flex-direction: column; }
.info { padding: 16px; text-align: center; display: flex; flex-direction: column; gap: 4px; font-size: .95rem; }
.act { appearance: none; border: 0; border-top: 1px solid var(--line); background: none; font: inherit; font-size: 1.05rem; font-weight: 600; padding: 15px; cursor: pointer; color: var(--accent); }
.act.danger { color: var(--bad); }
.cancel { font: inherit; font-size: 1.05rem; font-weight: 700; padding: 15px; cursor: pointer; color: var(--ink); text-align: center; }
.sheet-enter-active, .sheet-leave-active { transition: opacity .2s; }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
.sheet-enter-from .stack, .sheet-leave-to .stack { transform: translateY(40%); }
</style>
