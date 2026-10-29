<script setup lang="ts">
// Báo có bản mới (service worker mới đã tải xong) và cập nhật ngay không cần tắt app.
const { $pwa } = useNuxtApp()
const updating = ref(false)
const dismissed = ref(false)
const show = computed(() => !!$pwa?.needRefresh && !dismissed.value)

async function update() {
  updating.value = true
  await $pwa?.updateServiceWorker(true)
}

// Kiểm tra bản mới mỗi khi mở lại app / quay lại tab (app cài trên điện thoại hầu như không bao giờ reload).
function check() {
  if (document.visibilityState === 'visible') $pwa?.getSWRegistration()?.update().catch(() => {})
}
onMounted(() => document.addEventListener('visibilitychange', check))
onBeforeUnmount(() => document.removeEventListener('visibilitychange', check))
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="show" class="root" role="alertdialog" aria-modal="true" aria-label="Update available">
        <div class="backdrop" />
        <div class="stack">
          <div class="group">
            <div class="info">
              <b>New version available</b>
              <span class="muted">Update now to get the latest improvements. Your progress is kept.</span>
            </div>
            <button class="act" :disabled="updating" @click="update">{{ updating ? 'Updating…' : 'Update now' }}</button>
          </div>
          <button class="group cancel" :disabled="updating" @click="dismissed = true">Later</button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.root { position: fixed; inset: 0; z-index: 70; display: flex; align-items: flex-end; justify-content: center; }
.backdrop { position: absolute; inset: 0; background: rgba(20, 12, 4, .45); }
.stack { position: relative; width: 100%; max-width: 560px; padding: 12px 12px calc(12px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 8px; }
.group { background: var(--card); border-radius: 18px; overflow: hidden; border: 0; width: 100%; display: flex; flex-direction: column; }
.info { padding: 16px; text-align: center; display: flex; flex-direction: column; gap: 4px; font-size: .95rem; }
.act { appearance: none; border: 0; border-top: 1px solid var(--line); background: none; font: inherit; font-size: 1.05rem; font-weight: 650; padding: 15px; cursor: pointer; color: var(--accent); }
.cancel { font: inherit; font-size: 1.05rem; font-weight: 700; padding: 15px; cursor: pointer; color: var(--ink); text-align: center; }
button:disabled { opacity: .5; }
.sheet-enter-active, .sheet-leave-active { transition: opacity .2s; }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
</style>
