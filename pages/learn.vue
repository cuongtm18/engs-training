<script setup lang="ts">
import type { Sentence } from '~/utils/types'

const route = useRoute()
const router = useRouter()
const store = useStore()
const api = useApi()
const { byTopic } = useSentences()
const topics = useTopics()

const topicId = computed(() => String(route.query.t ?? ''))
const topic = computed(() => topics.byId(topicId.value))
const list = computed(() => byTopic(topicId.value))

const hideEn = ref(false)
const revealed = reactive<Record<string, boolean>>({})

// --- adding sentences: AI script or pasted list; both end in a reviewable list of drafts ---
interface Draft {
  vi: string
  en: string
  dup: boolean
}

const CHUNK = 12
const MAX_LINES = 100

const adding = ref(false)
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

const existing = () => new Set(list.value.map((s) => normalize(s.en)))

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
  const have = existing()
  const failed: string[] = []
  let firstError = ''
  try {
    for (let i = 0; i < src.length; i += CHUNK) {
      const chunk = src.slice(i, i + CHUNK)
      try {
        const r = await api.translate(chunk)
        r.items.forEach((it, j) => {
          if (it.vi && it.en) drafts.value.push({ vi: it.vi, en: it.en, dup: have.has(normalize(it.en)) })
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
    drafts.value.push({ vi: isVi ? l : '', en: isVi ? '' : l, dup: false })
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
    const r = await api.generate(topic.value!.label, situation.value, count.value, list.value.slice(0, 40).map((s) => s.en))
    const have = existing()
    drafts.value = r.items.map((it) => ({ vi: it.vi, en: it.en, dup: have.has(normalize(it.en)) }))
  } catch (e) {
    err.value = errorDetail(e)
  } finally {
    busy.value = false
  }
}

const ready = computed(() => drafts.value.filter((d) => d.vi.trim() && d.en.trim() && !d.dup))

function resetAdd() {
  raw.value = err.value = info.value = ''
  drafts.value = []
}

function saveAll() {
  if (!ready.value.length) return
  store.addSentences(ready.value.map((d) => ({ t: topicId.value, vi: d.vi.trim(), en: d.en.trim() })))
  resetAdd()
  adding.value = false
}

function remove(s: Sentence) {
  if (confirm(`Delete "${s.en}"?`)) store.removeSentence(s.id)
}

// --- custom topic management ---
const renaming = ref(false)
const newName = ref('')
function startRename() {
  newName.value = topic.value?.label ?? ''
  renaming.value = true
}
function saveRename() {
  if (topic.value && newName.value.trim()) store.renameTopic(topic.value.id, newName.value, topic.value.emoji)
  renaming.value = false
}
function deleteTopic() {
  if (!topic.value) return
  if (confirm(`Delete the topic "${topic.value.label}" and its ${list.value.length} sentence(s)?`)) {
    store.removeTopic(topic.value.id)
    router.replace('/')
  }
}

function speak(text: string) {
  if (!('speechSynthesis' in window)) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'en-US'
  u.rate = 0.95
  speechSynthesis.speak(u)
}

// a brand-new topic opens straight on the AI script panel
onMounted(() => {
  if (topic.value && !list.value.length) adding.value = true
})
onBeforeUnmount(() => {
  if (import.meta.client && 'speechSynthesis' in window) speechSynthesis.cancel()
})
</script>

<template>
  <template v-if="topic">
    <header class="row top">
      <NuxtLink to="/" class="btn ghost" aria-label="Back to topics">←</NuxtLink>
      <h1 class="grow">{{ topic.emoji }} {{ topic.label }}</h1>
      <NuxtLink v-if="list.length" :to="{ path: '/practice', query: { t: topic.id } }" class="btn primary">Practice</NuxtLink>
    </header>

    <div class="row bar">
      <span class="muted grow">{{ list.length }} {{ list.length === 1 ? 'sentence' : 'sentences' }} · Learn mode</span>
      <label class="check"><input v-model="hideEn" type="checkbox" /> Hide English</label>
    </div>

    <section class="card add">
      <button v-if="!adding" class="btn block" @click="adding = true">＋ Add sentences</button>
      <template v-else>
        <div class="row tabs">
          <button class="chip grow" :class="{ on: tab === 'ai' }" @click="tab = 'ai'">✨ AI script</button>
          <button class="chip grow" :class="{ on: tab === 'paste' }" @click="tab = 'paste'">📋 Paste a list</button>
        </div>

        <template v-if="tab === 'ai'">
          <p class="muted small hint">
            <template v-if="!list.length">This topic is empty. Let AI write a starter script for “{{ topic.label }}”.</template>
            <template v-else>Let AI write more sentences for “{{ topic.label }}”. Sentences you already have are skipped.</template>
          </p>
          <input v-model="situation" maxlength="200" placeholder="Situation (optional), e.g. checking in at a hotel" :disabled="busy" @keydown.enter.prevent="generate" />
          <div class="row">
            <label class="muted small">How many</label>
            <select v-model.number="count" :disabled="busy">
              <option :value="10">10</option>
              <option :value="15">15</option>
              <option :value="20">20</option>
            </select>
          </div>
          <button class="btn primary block" :disabled="busy" @click="generate">{{ busy ? 'Writing the script…' : `✨ Generate ${count} sentences` }}</button>
        </template>

        <template v-else>
          <p class="muted small hint">Paste a list, <b>one sentence per line</b>. English lines are translated to Vietnamese, Vietnamese lines to English.</p>
          <textarea v-model="raw" rows="7" placeholder="Excuse me, could you help me, please?&#10;Where is the train station?&#10;Go straight for two blocks." :disabled="busy" />
          <div class="row wrap">
            <button class="btn ghost" :disabled="busy" @click="fileInput?.click()">📄 Choose .txt file</button>
            <span class="muted small grow">{{ lines.length }} {{ lines.length === 1 ? 'sentence' : 'sentences' }}</span>
            <input ref="fileInput" type="file" accept=".txt,text/plain" hidden @change="onFile" />
          </div>
          <button class="btn primary block" :disabled="!lines.length || busy" @click="translateAll">
            {{ busy ? `Translating… ${progress.done}/${progress.total}` : `🌐 Translate ${Math.min(lines.length, MAX_LINES)} ${lines.length === 1 ? 'sentence' : 'sentences'}` }}
          </button>
        </template>

        <p v-if="info" class="muted small">{{ info }}</p>
        <p v-if="err" class="err">{{ err }}</p>

        <template v-if="drafts.length">
          <h2 class="rv">Review, then save ({{ ready.length }}/{{ drafts.length }})</h2>
          <div v-for="(d, i) in drafts" :key="i" class="draft" :class="{ dup: d.dup, miss: !(d.vi && d.en) }">
            <textarea v-model="d.en" rows="2" placeholder="English…" />
            <textarea v-model="d.vi" rows="2" lang="vi" placeholder="Vietnamese…" />
            <div class="row between">
              <span v-if="d.dup" class="tag">Already in this topic, will be skipped</span>
              <span v-else-if="!(d.vi && d.en)" class="tag warn">Fill in both fields</span>
              <span v-else />
              <button class="btn ghost" @click="drafts.splice(i, 1)">Remove</button>
            </div>
          </div>
        </template>

        <div class="row">
          <button class="btn ghost" :disabled="busy" @click="resetAdd(); adding = false">Close</button>
          <button class="btn primary grow" :disabled="!ready.length || busy" @click="saveAll">Save {{ ready.length }} to “{{ topic.label }}”</button>
        </div>
      </template>
    </section>

    <p v-if="!list.length" class="muted empty">No sentences yet.</p>

    <section class="list">
      <article v-for="s in list" :key="s.id" class="card item">
        <div class="row">
          <button v-if="hideEn && !revealed[s.id]" class="btn ghost grow" @click="revealed[s.id] = true">👁 Show answer</button>
          <b v-else class="en grow">{{ s.en }}</b>
          <button class="btn ghost" aria-label="Listen" @click="speak(s.en)">🔊</button>
        </div>
        <div class="vi" lang="vi">{{ s.vi }}</div>
        <template v-if="!hideEn || revealed[s.id]">
          <ul v-if="s.alt?.length" class="alts">
            <li v-for="a in s.alt" :key="a">{{ a }}</li>
          </ul>
          <p v-if="s.note" class="note">💡 {{ s.note }}</p>
        </template>
        <button v-if="s.custom" class="del muted" @click="remove(s)">Delete this sentence</button>
      </article>
    </section>

    <section v-if="topic.custom" class="manage">
      <template v-if="!renaming">
        <button class="del muted" @click="startRename">Rename topic</button>
        <button class="del muted" @click="deleteTopic">Delete topic</button>
      </template>
      <div v-else class="row">
        <input v-model="newName" maxlength="40" @keydown.enter.prevent="saveRename" />
        <button class="btn primary" @click="saveRename">Save</button>
      </div>
    </section>
  </template>

  <section v-else class="card">
    <p>Topic not found.</p>
    <NuxtLink to="/" class="btn">Back to topics</NuxtLink>
  </section>
</template>

<style scoped>
.top { margin: 8px 0 12px; }
.top h1 { font-size: 1.25rem; }
.top .btn { text-decoration: none; }
.bar { margin-bottom: 12px; }
.check { display: flex; gap: 6px; align-items: center; cursor: pointer; }
.check input { width: auto; }
.add { display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px; }
.tabs .chip { text-align: center; }
select { font: inherit; color: var(--ink); background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 8px 12px; }
.err { color: var(--bad); margin: 0; word-break: break-word; }
.small { font-size: .85rem; }
.hint { margin: 0; }
.rv { margin: 6px 0 0; }
.draft { display: flex; flex-direction: column; gap: 6px; padding: 10px; border: 1px solid var(--line); border-radius: 14px; }
.draft.dup { opacity: .55; }
.draft.miss { border-color: var(--warn); }
.between { justify-content: space-between; }
.tag { font-size: .75rem; padding: 2px 8px; border-radius: 99px; background: var(--soft); }
.tag.warn { background: var(--warn-bg); color: var(--warn); }
.empty { text-align: center; }
.list { display: flex; flex-direction: column; gap: 10px; }
.item { display: flex; flex-direction: column; gap: 8px; padding: 14px; }
.vi { color: var(--muted); }
.en { font-size: 1.1rem; }
.alts { margin: 0; padding-left: 20px; color: var(--muted); }
.note { margin: 0; font-size: .95rem; }
.del { appearance: none; border: 0; background: none; font: inherit; font-size: .85rem; cursor: pointer; align-self: flex-start; padding: 0; text-decoration: underline; }
.manage { display: flex; gap: 18px; margin: 18px 0 6px; }
</style>
