<script setup lang="ts">
import type { Sentence, Topic } from '~/utils/types'

const props = defineProps<{ modelValue: boolean; topic: Topic; existing: Sentence[] }>()
const emit = defineEmits<{ 'update:modelValue': [boolean]; saved: [Sentence[]] }>()

const store = useStore()
const api = useApi()
const undo = useUndo()

interface Draft {
  vi: string
  en: string
}

const CHUNK = 12
const MAX_LINES = 100

const tab = ref<'ai' | 'paste'>('ai')
const raw = ref('')
const situation = ref('')
const count = ref(15)
const drafts = ref<Draft[]>([])
const busy = ref(false)
const progress = ref({ done: 0, total: 0 })
const err = ref('')
const info = ref('')
const fileInput = ref<HTMLInputElement>()

const have = () => new Set(props.existing.map((s) => normalize(s.en)))

/** One sentence per line; drop blanks, bullets/numbering and duplicates. */
function parseLines(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of text.split(/\r?\n/)) {
    const l = line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim()
    const k = normalize(l)
    if (!l || seen.has(k)) continue
    seen.add(k)
    out.push(l.slice(0, 300))
  }
  return out
}

const lines = computed(() => parseLines(raw.value))
/** Per draft: 'topic' if already saved in this topic, 'batch' if an earlier draft has the same English. Case-insensitive, live while editing. */
const dupKind = computed<(null | 'topic' | 'batch')[]>(() => {
  const known = have()
  const seen = new Set<string>()
  return drafts.value.map((d) => {
    const k = normalize(d.en)
    if (!k) return null
    if (known.has(k)) return 'topic'
    if (seen.has(k)) return 'batch'
    seen.add(k)
    return null
  })
})
const ready = computed(() => drafts.value.filter((d, i) => d.vi.trim() && d.en.trim() && !dupKind.value[i]))
const noun = (n: number) => (n === 1 ? 'sentence' : 'sentences')

function reset() {
  raw.value = err.value = info.value = ''
  drafts.value = []
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    reset()
    tab.value = 'ai'
  },
)

async function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  raw.value = (raw.value ? raw.value.trimEnd() + '\n' : '') + (await f.text())
  ;(e.target as HTMLInputElement).value = ''
}

async function translateAll() {
  if (!lines.value.length || busy.value) return
  err.value = info.value = ''
  drafts.value = []
  const src = lines.value.slice(0, MAX_LINES)
  if (lines.value.length > MAX_LINES) info.value = `Only the first ${MAX_LINES} lines are translated; paste the rest next time.`
  busy.value = true
  progress.value = { done: 0, total: src.length }
  const failed: string[] = []
  let firstError = ''
  try {
    for (let i = 0; i < src.length; i += CHUNK) {
      const chunk = src.slice(i, i + CHUNK)
      try {
        const r = await api.translate(chunk)
        r.items.forEach((it, j) => {
          if (it.vi && it.en) drafts.value.push({ vi: it.vi, en: it.en })
          else failed.push(chunk[j]!)
        })
      } catch (e) {
        failed.push(...chunk)
        firstError ||= errorDetail(e)
      }
      progress.value.done = Math.min(src.length, i + CHUNK)
    }
  } finally {
    busy.value = false
  }
  // lines that failed stay in the list so you can fill them in by hand
  for (const l of failed) {
    const isVi = /[À-ỹ]/.test(l)
    drafts.value.push({ vi: isVi ? l : '', en: isVi ? '' : l })
  }
  if (failed.length) err.value = `${failed.length} line(s) could not be translated${firstError ? ': ' + firstError : '.'} They are at the top of the list: fill them in or remove them.`
  drafts.value.sort((a, b) => Number(!(b.vi && b.en)) - Number(!(a.vi && a.en)))
}

async function generate() {
  if (busy.value) return
  err.value = info.value = ''
  drafts.value = []
  busy.value = true
  try {
    const r = await api.generate(props.topic.label, situation.value, count.value, props.existing.slice(0, 40).map((s) => s.en))
    drafts.value = r.items.map((it) => ({ vi: it.vi, en: it.en }))
  } catch (e) {
    err.value = errorDetail(e)
  } finally {
    busy.value = false
  }
}

function removeDraft(i: number) {
  const [gone] = drafts.value.splice(i, 1)
  if (!gone) return
  undo.push({
    message: 'Sentence removed from the list',
    undo: () => {
      drafts.value.splice(Math.min(i, drafts.value.length), 0, gone)
    },
  })
}

function saveAll() {
  if (!ready.value.length) return
  const added = store.addSentences(ready.value.map((d) => ({ t: props.topic.id, vi: d.vi.trim(), en: d.en.trim() })))
  emit('saved', added)
  emit('update:modelValue', false)
}
</script>

<template>
  <AppSheet tall :model-value="modelValue" title="Add sentences" @update:model-value="emit('update:modelValue', $event)">
    <div class="seg" role="tablist">
      <button role="tab" :aria-selected="tab === 'ai'" :class="{ on: tab === 'ai' }" @click="tab = 'ai'">✨ AI script</button>
      <button role="tab" :aria-selected="tab === 'paste'" :class="{ on: tab === 'paste' }" @click="tab = 'paste'">📋 Paste a list</button>
    </div>

    <template v-if="tab === 'ai'">
      <p class="muted hint">
        <template v-if="!existing.length">This topic is empty. Let AI write a starter script for “{{ topic.label }}”.</template>
        <template v-else>Let AI write more sentences for “{{ topic.label }}”. Sentences you already have are skipped.</template>
        <template v-if="!situation"> Tip: add a situation such as “checking in at a hotel”.</template>
      </p>
      <input v-model="situation" maxlength="200" placeholder="Situation (optional)" :disabled="busy" @keydown.enter.prevent="generate" />
      <div class="row">
        <span class="muted grow">How many sentences</span>
        <div class="seg small">
          <button v-for="n in [10, 15, 20]" :key="n" :class="{ on: count === n }" :disabled="busy" @click="count = n">{{ n }}</button>
        </div>
      </div>
      <button class="btn primary block" :disabled="busy" @click="generate">{{ busy ? 'Writing the script…' : '✨ Generate' }}</button>
    </template>

    <template v-else>
      <p class="muted hint">Paste a list, <b>one sentence per line</b>. English lines are translated to Vietnamese, Vietnamese lines to English.</p>
      <textarea v-model="raw" rows="6" placeholder="Excuse me, could you help me, please?&#10;Where is the train station?&#10;Go straight for two blocks." :disabled="busy" />
      <div class="row wrap">
        <button class="btn ghost" :disabled="busy" @click="fileInput?.click()">📄 Choose .txt file</button>
        <span class="muted grow">{{ lines.length }} {{ noun(lines.length) }}</span>
        <input ref="fileInput" type="file" accept=".txt,text/plain" hidden @change="onFile" />
      </div>
      <button class="btn primary block" :disabled="!lines.length || busy" @click="translateAll">
        {{ busy ? `Translating… ${progress.done}/${progress.total}` : `🌐 Translate ${Math.min(lines.length, MAX_LINES)} ${noun(lines.length)}` }}
      </button>
    </template>

    <p v-if="info" class="muted">{{ info }}</p>
    <p v-if="err" class="err">{{ err }}</p>

    <template v-if="drafts.length">
      <h2 class="rv">Review ({{ ready.length }} of {{ drafts.length }} will be saved)</h2>
      <div v-for="(d, i) in drafts" :key="i" class="draft" :class="{ dup: dupKind[i], miss: !(d.vi && d.en) }">
        <textarea v-model="d.en" rows="2" placeholder="English…" />
        <textarea v-model="d.vi" rows="2" lang="vi" placeholder="Vietnamese…" />
        <div class="row between">
          <span v-if="dupKind[i]" class="tag warn">⚠️ {{ dupKind[i] === 'topic' ? 'Already in this topic' : 'Duplicate of another line above' }}, will be skipped</span>
          <span v-else-if="!(d.vi && d.en)" class="tag warn">Fill in both fields</span>
          <span v-else />
          <button class="btn ghost small-btn" @click="removeDraft(i)">Remove</button>
        </div>
      </div>
    </template>

    <template #footer>
      <button class="btn primary block" :disabled="!ready.length || busy" @click="saveAll">Save {{ ready.length }} {{ noun(ready.length) }} to “{{ topic.label }}”</button>
    </template>
  </AppSheet>
</template>

<style scoped>
.hint { margin: 0; font-size: .92rem; }
.err { color: var(--bad); margin: 0; word-break: break-word; }
.rv { margin: 6px 0 0; }
.draft { display: flex; flex-direction: column; gap: 6px; padding: 10px; background: var(--card); border: 1px solid var(--line); border-radius: 18px; }
.draft.dup { border-color: var(--warn); background: var(--warn-bg); }
.draft.dup textarea { opacity: .6; }
.draft.miss { border-color: var(--warn); }
.between { justify-content: space-between; }
.tag { font-size: .75rem; padding: 2px 8px; border-radius: 99px; background: var(--soft); }
.tag.warn { background: var(--warn-bg); color: var(--warn); }
.small-btn { min-height: 44px; padding: 6px 14px; }
</style>
