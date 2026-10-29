<script setup lang="ts">
const store = useStore()
const topics = useTopics()
const confirm = useConfirm()
const s = computed(() => store.state.value.settings)
const msg = ref('')
const fileInput = ref<HTMLInputElement>()

function step(key: 'sessionSize' | 'dailyNew', delta: number, min: number, max: number) {
  store.setSettings({ [key]: Math.min(max, Math.max(min, s.value[key] + delta)) })
  navigator.vibrate?.(6)
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

async function doReset() {
  const ok = await confirm.ask({ title: 'Reset everything?', message: 'This deletes all progress, your own topics and your own sentences. It cannot be undone.', confirmText: 'Reset everything' })
  if (ok) {
    store.reset()
    msg.value = 'Everything has been reset.'
  }
}
</script>

<template>
  <header class="head"><h1 class="large-title">Settings</h1></header>

  <p class="cap">Practice</p>
  <section class="group">
    <div class="item">
      <span class="grow">Sentences per round</span>
      <div class="stepper">
        <button :disabled="s.sessionSize <= 3" aria-label="Fewer" @click="step('sessionSize', -1, 3, 50)">−</button>
        <b>{{ s.sessionSize }}</b>
        <button :disabled="s.sessionSize >= 50" aria-label="More" @click="step('sessionSize', 1, 3, 50)">＋</button>
      </div>
    </div>
    <div class="item">
      <span class="grow">Max new per round</span>
      <div class="stepper">
        <button :disabled="s.dailyNew <= 0" aria-label="Fewer" @click="step('dailyNew', -1, 0, 100)">−</button>
        <b>{{ s.dailyNew }}</b>
        <button :disabled="s.dailyNew >= 100" aria-label="More" @click="step('dailyNew', 1, 0, 100)">＋</button>
      </div>
    </div>
  </section>

  <p class="cap">AI access</p>
  <section class="group">
    <label class="item col">
      <span>Access code <span class="muted small">(only if the server sets ACCESS_CODE)</span></span>
      <input type="password" :value="s.accessCode" autocomplete="off" placeholder="Optional" @change="store.setSettings({ accessCode: ($event.target as HTMLInputElement).value })" />
    </label>
  </section>

  <template v-if="topics.hidden.value.length">
    <p class="cap">Removed topics</p>
    <section class="group">
      <div v-for="t in topics.hidden.value" :key="t.id" class="item">
        <span class="em">{{ t.emoji }}</span>
        <span class="grow">{{ t.label }}</span>
        <button class="link" @click="store.unhideTopic(t.id)">Restore</button>
      </div>
    </section>
  </template>

  <p class="cap">Data</p>
  <section class="group">
    <button class="item action" @click="doExport">Export progress</button>
    <button class="item action" @click="fileInput?.click()">Import progress</button>
    <button class="item action danger" @click="doReset">Reset everything</button>
  </section>
  <input ref="fileInput" type="file" accept="application/json" hidden @change="doImport" />
  <p v-if="msg" class="note">{{ msg }}</p>
  <p class="note">Progress, topics and sentences are stored only on this device. Use Export and Import to move them to another device.</p>
</template>

<style scoped>
.head { margin: 8px 0 8px; }
.cap { margin: 18px 12px 6px; font-size: .78rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
.group { background: var(--card); border: 1px solid var(--line); border-radius: 20px; overflow: hidden; box-shadow: var(--shadow); }
.item { display: flex; align-items: center; gap: 10px; padding: 12px 16px; min-height: 54px; width: 100%; background: none; border: 0; font: inherit; color: var(--ink); text-align: left; }
.item + .item { border-top: 1px solid var(--line); }
.item.col { flex-direction: column; align-items: stretch; gap: 8px; font-weight: 600; }
.action { cursor: pointer; font-weight: 600; color: var(--accent); }
.action.danger { color: var(--bad); }
.action:active { background: var(--soft); }
.em { font-size: 1.3rem; }
.link { appearance: none; border: 0; background: none; color: var(--accent); font: inherit; font-weight: 650; cursor: pointer; }
.stepper { display: flex; align-items: center; gap: 4px; background: var(--soft); border-radius: 12px; padding: 3px; }
.stepper b { min-width: 34px; text-align: center; font-variant-numeric: tabular-nums; }
.stepper button { appearance: none; border: 0; width: 36px; height: 34px; border-radius: 9px; background: var(--card); color: var(--ink); font: inherit; font-size: 1.1rem; cursor: pointer; }
.stepper button:disabled { opacity: .35; }
.note { margin: 10px 12px 0; font-size: .85rem; color: var(--muted); }
</style>
