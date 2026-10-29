<script setup lang="ts">
const store = useStore()
const s = computed(() => store.state.value.settings)
const msg = ref('')
const fileInput = ref<HTMLInputElement>()

function num(e: Event, key: 'sessionSize' | 'dailyNew', min: number, max: number) {
  const v = Math.min(max, Math.max(min, Number((e.target as HTMLInputElement).value) || min))
  store.setSettings({ [key]: v })
}

function doExport() {
  const blob = new Blob([store.exportJson()], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `english-reflex-progress-${dayKey()}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}

async function doImport(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  try {
    store.importJson(await f.text())
    msg.value = 'Progress imported.'
  } catch {
    msg.value = 'That file is not valid.'
  }
}

function doReset() {
  if (confirm('Delete all progress, your own topics and your own sentences?')) {
    store.reset()
    msg.value = 'Everything has been reset.'
  }
}
</script>

<template>
  <header class="row top">
    <NuxtLink to="/" class="btn ghost" aria-label="Back">←</NuxtLink>
    <h1>Settings</h1>
  </header>

  <section class="card f">
    <label>Sentences per practice round
      <input type="number" inputmode="numeric" :value="s.sessionSize" @change="num($event, 'sessionSize', 3, 50)" />
    </label>
    <label>Max new sentences per round
      <input type="number" inputmode="numeric" :value="s.dailyNew" @change="num($event, 'dailyNew', 0, 100)" />
    </label>
    <label>Access code (only if you set ACCESS_CODE on the server)
      <input type="password" :value="s.accessCode" autocomplete="off" @change="store.setSettings({ accessCode: ($event.target as HTMLInputElement).value })" />
    </label>
  </section>

  <section class="card f">
    <h2>Data</h2>
    <div class="row wrap">
      <button class="btn" @click="doExport">Export progress</button>
      <button class="btn" @click="fileInput?.click()">Import progress</button>
      <button class="btn ghost" @click="doReset">Reset everything</button>
    </div>
    <input ref="fileInput" type="file" accept="application/json" hidden @change="doImport" />
    <p v-if="msg" class="muted">{{ msg }}</p>
    <p class="muted small">Progress, topics and sentences are stored only on this device. Use Export / Import to move them to another device.</p>
  </section>
</template>

<style scoped>
.top { margin: 8px 0 16px; }
.f { margin-bottom: 14px; display: flex; flex-direction: column; gap: 14px; }
label { display: flex; flex-direction: column; gap: 6px; font-weight: 600; }
.small { font-size: .85rem; margin: 0; }
</style>
