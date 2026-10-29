<script setup lang="ts">
import type { Sentence } from '~/utils/types'

const route = useRoute()
const store = useStore()
const api = useApi()
const { byTopic } = useSentences()

const topicId = computed(() => String(route.query.t ?? ''))
const topic = computed(() => topicById(topicId.value))
const list = computed(() => byTopic(topicId.value))

const hideEn = ref(false)
const revealed = reactive<Record<string, boolean>>({})

// --- thêm nhiều câu một lúc ---
interface Draft {
  vi: string
  en: string
  dup: boolean
}

const CHUNK = 12
const MAX_LINES = 100

const adding = ref(false)
const raw = ref('')
const drafts = ref<Draft[]>([])
const translating = ref(false)
const progress = ref({ done: 0, total: 0 })
const err = ref('')
const info = ref('')
const fileInput = ref<HTMLInputElement>()

/** Mỗi dòng là một câu; bỏ dòng trống, bỏ số thứ tự hoặc gạch đầu dòng, bỏ dòng trùng nhau. */
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
  if (!lines.value.length || translating.value) return
  err.value = info.value = ''
  drafts.value = []
  const src = lines.value.slice(0, MAX_LINES)
  if (lines.value.length > MAX_LINES) info.value = `Chỉ dịch ${MAX_LINES} dòng đầu, hãy dán phần còn lại ở lần sau.`
  translating.value = true
  progress.value = { done: 0, total: src.length }
  const existing = new Set(list.value.map((s) => normalize(s.en)))
  const failed: string[] = []
  let firstError = ''
  try {
    for (let i = 0; i < src.length; i += CHUNK) {
      const chunk = src.slice(i, i + CHUNK)
      try {
        const r = await api.translate(chunk)
        r.items.forEach((it, j) => {
          if (it.vi && it.en) drafts.value.push({ vi: it.vi, en: it.en, dup: existing.has(normalize(it.en)) })
          else failed.push(chunk[j]!)
        })
      } catch (e) {
        failed.push(...chunk)
        firstError ||= errorDetail(e)
      }
      progress.value.done = Math.min(src.length, i + CHUNK)
    }
  } finally {
    translating.value = false
  }
  // dòng dịch lỗi vẫn đưa vào danh sách để bạn tự điền nốt
  for (const l of failed) drafts.value.push({ vi: /[\u00C0-\u1EF9]/.test(l) ? l : '', en: /[\u00C0-\u1EF9]/.test(l) ? '' : l, dup: false })
  if (failed.length) err.value = `${failed.length} câu chưa dịch được${firstError ? ': ' + firstError : '.'} Các câu đó nằm đầu danh sách, bạn có thể tự điền hoặc bỏ đi.`
  drafts.value.sort((a, b) => Number(!(b.vi && b.en)) - Number(!(a.vi && a.en)))
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
  if (confirm(`Xóa câu "${s.vi}"?`)) store.removeSentence(s.id)
}

function speak(text: string) {
  if (!('speechSynthesis' in window)) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'en-US'
  u.rate = 0.95
  speechSynthesis.speak(u)
}

onBeforeUnmount(() => {
  if (import.meta.client && 'speechSynthesis' in window) speechSynthesis.cancel()
})
</script>

<template>
  <template v-if="topic">
    <header class="row top">
      <NuxtLink to="/" class="btn ghost" aria-label="Về trang chủ">←</NuxtLink>
      <h1 class="grow">{{ topic.emoji }} {{ topic.label }}</h1>
      <NuxtLink v-if="list.length" :to="{ path: '/practice', query: { t: topic.id } }" class="btn primary">Luyện tập</NuxtLink>
    </header>

    <div class="row bar">
      <span class="muted grow">{{ list.length }} câu · Chế độ học</span>
      <label class="check"><input v-model="hideEn" type="checkbox" /> Ẩn tiếng Anh</label>
    </div>

    <section class="card add">
      <button v-if="!adding" class="btn block" @click="adding = true">＋ Thêm nhiều câu</button>
      <template v-else>
        <h2>Thêm nhiều câu một lúc</h2>
        <p class="muted small hint">Dán danh sách, <b>mỗi dòng một câu</b>. Dòng tiếng Anh sẽ được dịch sang tiếng Việt, dòng tiếng Việt thì dịch sang tiếng Anh.</p>
        <textarea v-model="raw" rows="7" placeholder="Excuse me, could you help me, please?&#10;Where is the train station?&#10;Go straight for two blocks." :disabled="translating" />
        <div class="row wrap">
          <button class="btn ghost" :disabled="translating" @click="fileInput?.click()">📄 Chọn file .txt</button>
          <span class="muted small grow">{{ lines.length }} câu</span>
          <input ref="fileInput" type="file" accept=".txt,text/plain" hidden @change="onFile" />
        </div>
        <button class="btn primary block" :disabled="!lines.length || translating" @click="translateAll">
          {{ translating ? `Đang dịch… ${progress.done}/${progress.total}` : `🌐 Dịch ${Math.min(lines.length, MAX_LINES)} câu` }}
        </button>
        <p v-if="info" class="muted small">{{ info }}</p>
        <p v-if="err" class="err">{{ err }}</p>

        <template v-if="drafts.length">
          <h2 class="rv">Kiểm tra lại rồi lưu ({{ ready.length }}/{{ drafts.length }} câu)</h2>
          <div v-for="(d, i) in drafts" :key="i" class="draft" :class="{ dup: d.dup, miss: !(d.vi && d.en) }">
            <textarea v-model="d.vi" rows="2" placeholder="Tiếng Việt…" />
            <textarea v-model="d.en" rows="2" placeholder="Tiếng Anh…" />
            <div class="row between">
              <span v-if="d.dup" class="tag">Đã có trong chủ đề, sẽ bỏ qua</span>
              <span v-else-if="!(d.vi && d.en)" class="tag warn">Cần điền đủ hai ô</span>
              <span v-else />
              <button class="btn ghost" @click="drafts.splice(i, 1)">Bỏ câu này</button>
            </div>
          </div>
        </template>

        <div class="row">
          <button class="btn ghost" :disabled="translating" @click="resetAdd(); adding = false">Đóng</button>
          <button class="btn primary grow" :disabled="!ready.length || translating" @click="saveAll">Lưu {{ ready.length }} câu vào "{{ topic.label }}"</button>
        </div>
      </template>
    </section>

    <p v-if="!list.length" class="muted empty">Chưa có câu nào. Hãy thêm câu đầu tiên ở trên.</p>

    <section class="list">
      <article v-for="s in list" :key="s.id" class="card item">
        <div class="vi">{{ s.vi }}</div>
        <div class="row">
          <button v-if="hideEn && !revealed[s.id]" class="btn ghost grow" @click="revealed[s.id] = true">👁 Hiện đáp án</button>
          <b v-else class="en grow">{{ s.en }}</b>
          <button class="btn ghost" aria-label="Nghe" @click="speak(s.en)">🔊</button>
        </div>
        <template v-if="!hideEn || revealed[s.id]">
          <ul v-if="s.alt?.length" class="alts">
            <li v-for="a in s.alt" :key="a">{{ a }}</li>
          </ul>
          <p v-if="s.note" class="note">💡 {{ s.note }}</p>
        </template>
        <button v-if="s.custom" class="del muted" @click="remove(s)">Xóa câu này</button>
      </article>
    </section>
  </template>

  <section v-else class="card">
    <p>Không tìm thấy chủ đề.</p>
    <NuxtLink to="/" class="btn">Về trang chủ</NuxtLink>
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
.err { color: var(--bad); margin: 0; }
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
</style>
