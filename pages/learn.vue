<script setup lang="ts">
import type { Sentence, TranslateResult } from '~/utils/types'

const route = useRoute()
const store = useStore()
const api = useApi()
const { byTopic } = useSentences()

const topicId = computed(() => String(route.query.t ?? ''))
const topic = computed(() => topicById(topicId.value))
const list = computed(() => byTopic(topicId.value))

const hideEn = ref(false)
const revealed = reactive<Record<string, boolean>>({})

// --- thêm câu ---
const adding = ref(false)
const vi = ref('')
const en = ref('')
const alts = ref<string[]>([])
const note = ref('')
const translating = ref(false)
const err = ref('')
const engine = ref<TranslateResult['engine'] | ''>('')

async function translate() {
  const text = vi.value.trim()
  if (!text || translating.value) return
  translating.value = true
  err.value = ''
  try {
    const r = await api.translate(text)
    en.value = r.en
    alts.value = r.alternatives
    note.value = r.note
    engine.value = r.engine
  } catch (e) {
    err.value = errorDetail(e) + ' Bạn vẫn có thể tự gõ câu tiếng Anh rồi lưu.'
  } finally {
    translating.value = false
  }
}

function reset() {
  vi.value = en.value = note.value = err.value = ''
  alts.value = []
  engine.value = ''
}

function save() {
  if (!vi.value.trim() || !en.value.trim()) return
  store.addSentence({
    t: topicId.value,
    vi: vi.value.trim(),
    en: en.value.trim(),
    alt: alts.value.filter(Boolean),
    note: note.value.trim() || undefined,
  })
  reset()
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
      <button v-if="!adding" class="btn block" @click="adding = true">＋ Thêm câu của bạn</button>
      <template v-else>
        <h2>Thêm câu mới</h2>
        <textarea v-model="vi" rows="2" placeholder="Gõ câu tiếng Việt bạn muốn học…" @keydown.enter.exact.prevent="translate" />
        <button class="btn primary block" :disabled="!vi.trim() || translating" @click="translate">
          {{ translating ? 'Đang dịch…' : '🌐 Dịch sang tiếng Anh' }}
        </button>
        <p v-if="err" class="err">{{ err }}</p>

        <template v-if="en || engine || err">
          <label class="lbl">Tiếng Anh (bạn có thể sửa)</label>
          <textarea v-model="en" rows="2" placeholder="Câu tiếng Anh…" />
          <div v-if="alts.length" class="alts-edit">
            <div class="muted small">Các cách nói khác</div>
            <div v-for="(a, i) in alts" :key="i" class="row alt">
              <input v-model="alts[i]" />
              <button class="btn ghost" aria-label="Bỏ" @click="alts.splice(i, 1)">✕</button>
            </div>
          </div>
          <p v-if="note" class="note">💡 {{ note }}</p>
        </template>

        <div class="row">
          <button class="btn ghost" @click="reset(); adding = false">Hủy</button>
          <button class="btn primary grow" :disabled="!vi.trim() || !en.trim()" @click="save(); adding = false">Lưu vào "{{ topic.label }}"</button>
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
.lbl { font-weight: 600; margin-top: 4px; }
.err { color: var(--bad); margin: 0; }
.small { font-size: .85rem; }
.alt input { flex: 1; }
.alts-edit { display: flex; flex-direction: column; gap: 6px; }
.empty { text-align: center; }
.list { display: flex; flex-direction: column; gap: 10px; }
.item { display: flex; flex-direction: column; gap: 8px; padding: 14px; }
.vi { color: var(--muted); }
.en { font-size: 1.1rem; }
.alts { margin: 0; padding-left: 20px; color: var(--muted); }
.note { margin: 0; font-size: .95rem; }
.del { appearance: none; border: 0; background: none; font: inherit; font-size: .85rem; cursor: pointer; align-self: flex-start; padding: 0; text-decoration: underline; }
</style>
