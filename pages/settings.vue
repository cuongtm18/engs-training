<script setup lang="ts">
const store = useStore()
const topics = useTopics()
const confirm = useConfirm()
const undo = useUndo()
const s = computed(() => store.state.value.settings)
const msg = ref('')
const fileInput = ref<HTMLInputElement>()

function step(key: 'sessionSize' | 'dailyNew', delta: number, min: number, max: number) {
  store.setSettings({ [key]: Math.min(max, Math.max(min, s.value[key] + delta)) })
  haptic(6)
}

// ---- backup & restore ----
const LAST_KEY = 'engs.lastBackup' // only on this device; deliberately NOT part of the backup file
const lastBackup = ref<string | null>(null)
onMounted(() => {
  try {
    lastBackup.value = localStorage.getItem(LAST_KEY)
  } catch { /* ignore */ }
})
const fmt = (iso: string) => new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
const current = computed(() => summarize(store.backupData()))
const hasData = computed(() => current.value.reviewed > 0 || current.value.ownSentences > 0 || current.value.ownTopics > 0 || current.value.answered > 0)
const err = ref('')
const busy = ref(false)

function markBackedUp() {
  const now = new Date().toISOString()
  lastBackup.value = now
  try {
    localStorage.setItem(LAST_KEY, now)
  } catch { /* ignore */ }
}

async function doExport() {
  err.value = ''
  const name = `english-reflex-backup-${dayKey()}.json`
  const json = store.exportJson()
  const file = new File([json], name, { type: 'application/json' })
  try {
    // Installed iPhone app: the share sheet lets you "Save to Files", AirDrop it, mail it to yourself, etc.
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'English Reflex backup' })
      markBackedUp()
      undo.push({ message: 'Backup ready' })
      return
    }
  } catch (e) {
    if ((e as DOMException)?.name === 'AbortError') return // you closed the share sheet
    /* any other share error: fall back to a normal download */
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  markBackedUp()
  undo.push({ message: `Backup downloaded (${name})` })
}

async function doImport(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = '' // allow choosing the same file again
  if (!f) return
  err.value = ''
  busy.value = true
  try {
    if (f.size > 25_000_000) throw new Error('This file is too large to be a backup.')
    const parsed = parseBackup(await f.text())
    if (!parsed.ok) {
      err.value = parsed.error
      return
    }
    const warn: string[] = []
    if (parsed.dropped) warn.push(`${parsed.dropped} damaged ${parsed.dropped === 1 ? 'item was' : 'items were'} skipped.`)
    if (hasData.value && current.value.answered > parsed.summary.answered) warn.push(`Heads up: this device has more progress (${current.value.answered} answers) than the backup (${parsed.summary.answered}).`)
    const ok = await confirm.ask({
      title: 'Replace everything with this backup?',
      message: [describeBackup(parsed.summary), ...warn, 'Your current data will be replaced. You can undo for 10 seconds.'].join(' '),
      confirmText: 'Replace',
    })
    if (!ok) return
    const restore = store.applyBackup(parsed.data)
    undo.push({ message: 'Backup restored', undo: restore, duration: 10000 })
  } catch (error) {
    err.value = (error as Error).message || 'That file could not be read.'
  } finally {
    busy.value = false
  }
}

async function doReset() {
  const ok = await confirm.ask({ title: 'Reset everything?', message: 'This deletes all progress, your own topics and your own sentences. It cannot be undone.', confirmText: 'Reset everything' })
  if (ok) {
    const restore = store.reset()
    undo.push({ message: 'Everything was reset', undo: restore, duration: 10000 })
    msg.value = ''
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
        <button :disabled="s.sessionSize <= 3" aria-label="Fewer" @click="step('sessionSize', -1, 3, 50)"><AppIcon name="minus" :size="16" /></button>
        <b>{{ s.sessionSize }}</b>
        <button :disabled="s.sessionSize >= 50" aria-label="More" @click="step('sessionSize', 1, 3, 50)"><AppIcon name="plus" :size="16" /></button>
      </div>
    </div>
    <div class="item">
      <span class="grow">Max new per round</span>
      <div class="stepper">
        <button :disabled="s.dailyNew <= 0" aria-label="Fewer" @click="step('dailyNew', -1, 0, 100)"><AppIcon name="minus" :size="16" /></button>
        <b>{{ s.dailyNew }}</b>
        <button :disabled="s.dailyNew >= 100" aria-label="More" @click="step('dailyNew', 1, 0, 100)"><AppIcon name="plus" :size="16" /></button>
      </div>
    </div>
  </section>

  <p class="cap">AI access</p>
  <section class="group">
    <label class="item col">
      <span>Access code</span>
      <input type="password" :value="s.accessCode" autocomplete="off" placeholder="Optional" @change="store.setSettings({ accessCode: ($event.target as HTMLInputElement).value })" />
      <span class="help">Only needed if the server has an ACCESS_CODE set.</span>
    </label>
  </section>

  <template v-if="topics.hidden.value.length">
    <p class="cap">Removed topics</p>
    <section class="group">
      <div v-for="t in topics.hidden.value" :key="t.id" class="item">
        <TopicIcon :emoji="t.emoji" :icon="t.icon" :size="28" />
        <span class="grow">{{ t.label }}</span>
        <button class="link" @click="restoreTopic(t.id, t.label)">Restore</button>
      </div>
    </section>
  </template>

  <p class="cap">Backup &amp; restore</p>
  <section class="group">
    <button class="item action stack" @click="doExport">
      <span>Export backup</span>
      <span class="sub">Saves everything to a file you keep</span>
    </button>
    <button class="item action stack" :disabled="busy" @click="fileInput?.click()">
      <span>Import backup</span>
      <span class="sub">Restore from a file, e.g. on a new device</span>
    </button>
  </section>
  <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="doImport" />
  <p v-if="err" class="note errmsg" role="alert">{{ err }}</p>
  <p class="note" :class="{ warnmsg: hasData && !lastBackup }">
    <template v-if="lastBackup">Last backup: {{ fmt(lastBackup) }}.</template>
    <template v-else-if="hasData">You have not made a backup on this device yet.</template>
    <template v-else>Nothing to back up yet.</template>
  </p>
  <p class="note">
    A backup contains your progress and history, your own sentences and topics (with custom icons), edits to the built-in topics, sentence order, chat positions, practice settings and saved AI answers. It does <b>not</b> contain your access code.
  </p>

  <p class="cap">Danger zone</p>
  <section class="group">
    <button class="item action danger" @click="doReset">Reset everything</button>
  </section>
  <p v-if="msg" class="note">{{ msg }}</p>
  <p class="note">Everything is stored only on this device. To move to another device: Export backup here, then Import backup there.</p>
</template>

<style scoped>
.stack { flex-direction: column; align-items: flex-start; gap: 2px; }
.sub { font-size: .82rem; font-weight: 400; color: var(--muted); }
.errmsg { color: var(--bad); font-weight: 600; }
.warnmsg { color: var(--warn); font-weight: 600; }
.item:disabled { opacity: .5; }
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
.link { appearance: none; border: 0; background: none; color: var(--accent); font: inherit; font-weight: 650; cursor: pointer; min-height: 44px; padding: 0 4px; margin-right: -4px; }
.stepper { display: flex; align-items: center; gap: 4px; background: var(--soft); border-radius: 12px; padding: 3px; }
.stepper b { min-width: 34px; text-align: center; font-variant-numeric: tabular-nums; }
.stepper button { appearance: none; border: 0; width: 40px; height: 40px; border-radius: 9px; background: var(--card); color: var(--ink); cursor: pointer; display: grid; place-items: center; padding: 0; }
.stepper button:disabled { opacity: .35; }
.help { font-size: .82rem; font-weight: 400; color: var(--muted); }
.note { margin: 10px 12px 0; font-size: .85rem; color: var(--muted); }
</style>
