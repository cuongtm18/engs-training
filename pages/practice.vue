<script setup lang="ts">
import sentences from '~/data/sentences.json'
import type { CheckResult, Sentence } from '~/utils/types'

const route = useRoute()
const store = useStore()
const settings = computed(() => store.state.value.settings)

type Phase = 'answer' | 'checking' | 'result' | 'done'

const queue = ref<Sentence[]>([])
const index = ref(0)
const phase = ref<Phase>('answer')
const answer = ref('')
const result = ref<CheckResult | null>(null)
const revealed = ref(false)
const elapsed = ref(0)
const requeued = new Set<string>()
const tally = reactive({ perfect: 0, good: 0, wrong: 0 })
const input = ref<HTMLTextAreaElement>()

let started = 0
let timer: ReturnType<typeof setInterval> | undefined

const current = computed(() => queue.value[index.value])
const remaining = computed(() => Math.max(0, settings.value.seconds - elapsed.value))
const progress = computed(() => Math.min(100, (elapsed.value / settings.value.seconds) * 100))
const late = computed(() => elapsed.value > settings.value.seconds)

function build() {
  const topics = String(route.query.t ?? '').split(',').filter(Boolean)
  const levels = String(route.query.l ?? '1,2,3').split(',').map(Number)
  const pool = (sentences as Sentence[]).filter((s) => topics.includes(s.t) && levels.includes(s.l))
  const now = Date.now()
  const cards = store.state.value.cards
  const due = shuffle(pool.filter((s) => cards[s.id] && cards[s.id]!.due <= now))
  const fresh = shuffle(pool.filter((s) => !cards[s.id]))
  const size = settings.value.sessionSize
  const picked = due.slice(0, size)
  picked.push(...fresh.slice(0, Math.min(size - picked.length, settings.value.dailyNew)))
  // chưa đủ thì lấy thêm các câu chưa tới hạn để luôn có bài luyện
  if (picked.length < size) {
    const rest = shuffle(pool.filter((s) => !picked.includes(s)))
    picked.push(...rest.slice(0, size - picked.length))
  }
  queue.value = shuffle(picked)
}

function beginCard() {
  answer.value = ''
  result.value = null
  revealed.value = false
  elapsed.value = 0
  phase.value = 'answer'
  started = performance.now()
  clearInterval(timer)
  timer = setInterval(() => (elapsed.value = (performance.now() - started) / 1000), 100)
  nextTick(() => input.value?.focus())
}

function stopTimer() {
  clearInterval(timer)
  elapsed.value = (performance.now() - started) / 1000
}

function offlineVerdict(s: Sentence, text: string): CheckResult {
  const { ref } = diffWords(text, closestAnswer(text, s))
  const ratio = ref.filter((t) => t.ok).length / Math.max(ref.length, 1)
  return {
    verdict: ratio >= 0.85 ? 'good' : 'wrong',
    natural: closestAnswer(text, s),
    explanation: 'Không gọi được AI nên app chỉ so sánh với đáp án mẫu.',
    engine: 'offline',
  }
}

async function submit() {
  const s = current.value
  const text = answer.value.trim()
  if (!s || !text || phase.value !== 'answer') return
  stopTimer()

  if (matchesAny(text, s)) {
    finish({ verdict: 'perfect', natural: text, explanation: 'Chuẩn rồi! Câu này đúng và tự nhiên.', engine: 'local' })
    return
  }

  phase.value = 'checking'
  const ck = hashKey(s.id, text)
  const cached = store.state.value.cache[ck]
  if (cached) return finish(cached)

  try {
    const res = await $fetch<CheckResult>('/api/check', {
      method: 'POST',
      headers: settings.value.accessCode ? { 'x-access-code': settings.value.accessCode } : {},
      body: { vi: s.vi, answer: text, reference: s.en, alternatives: s.alt ?? [] },
      timeout: 20_000,
    })
    store.state.value.cache[ck] = res
    finish(res)
  } catch {
    finish(offlineVerdict(s, text))
  }
}

function finish(res: CheckResult) {
  const s = current.value!
  result.value = res
  phase.value = 'result'
  tally[res.verdict]++
  const quality = res.verdict === 'wrong' ? 0 : res.verdict === 'perfect' && !late.value ? 2 : 1
  store.grade(s.id, quality)
  if (quality === 0 && !requeued.has(s.id)) {
    requeued.add(s.id)
    queue.value.push(s)
  }
}

function reveal() {
  const s = current.value
  if (!s || phase.value !== 'answer') return
  stopTimer()
  revealed.value = true
  finish({ verdict: 'wrong', natural: s.en, explanation: 'Bạn đã xem đáp án. Câu này sẽ quay lại sớm để ôn.', engine: 'local' })
}

function next() {
  if (index.value + 1 >= queue.value.length) {
    clearInterval(timer)
    phase.value = 'done'
    return
  }
  index.value++
  beginCard()
}

function speak(text: string) {
  if (!('speechSynthesis' in window)) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'en-US'
  u.rate = 0.95
  speechSynthesis.speak(u)
}

function onKey(e: KeyboardEvent) {
  if (e.key !== 'Enter' || e.shiftKey) return
  if (phase.value === 'answer') {
    e.preventDefault()
    submit()
  } else if (phase.value === 'result') {
    e.preventDefault()
    next()
  }
}

const diff = computed(() => {
  const s = current.value
  if (!s || !answer.value.trim() || phase.value !== 'result' || revealed.value) return null
  return diffWords(answer.value, closestAnswer(answer.value, s)).user
})

onMounted(() => {
  build()
  if (!queue.value.length) return navigateTo('/')
  beginCard()
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  clearInterval(timer)
  window.removeEventListener('keydown', onKey)
  if (import.meta.client && 'speechSynthesis' in window) speechSynthesis.cancel()
})

const verdictText = { perfect: 'Tuyệt vời! 🎉', good: 'Gần đúng rồi 👍', wrong: 'Chưa đúng 💪' }
</script>

<template>
  <template v-if="phase !== 'done' && current">
    <header class="row top">
      <NuxtLink to="/" class="btn ghost" aria-label="Thoát">✕</NuxtLink>
      <div class="bar grow"><i :style="{ width: ((index + (phase === 'result' ? 1 : 0)) / queue.length) * 100 + '%' }" /></div>
      <span class="muted">{{ index + 1 }}/{{ queue.length }}</span>
    </header>

    <section class="card q">
      <div class="row between">
        <span class="muted">Câu {{ index + 1 }}</span>
        <span v-if="phase === 'answer'" class="time" :class="{ late }">{{ late ? 'Chậm rồi!' : Math.ceil(remaining) + 's' }}</span>
      </div>
      <p class="vi">{{ current.vi }}</p>
      <div v-if="phase === 'answer'" class="timebar"><i :class="{ late }" :style="{ width: 100 - progress + '%' }" /></div>

      <textarea
        ref="input"
        v-model="answer"
        rows="3"
        placeholder="Gõ câu tiếng Anh…"
        autocapitalize="sentences"
        autocomplete="off"
        autocorrect="off"
        spellcheck="false"
        :readonly="phase !== 'answer'"
      />

      <div v-if="phase === 'answer'" class="row wrap actions">
        <button class="btn primary grow" :disabled="!answer.trim()" @click="submit">Kiểm tra</button>
        <button class="btn" @click="reveal">Hiện đáp án</button>
        <button class="btn ghost" :disabled="!answer" @click="answer = ''; input?.focus()">Xóa phần viết</button>
      </div>
      <div v-else-if="phase === 'checking'" class="muted checking">Đang chấm bài…</div>
    </section>

    <section v-if="phase === 'result' && result" class="card res" :class="result.verdict">
      <div class="row between">
        <h2>{{ verdictText[result.verdict] }}</h2>
        <span v-if="result.engine === 'offline'" class="tag">offline</span>
      </div>

      <p v-if="diff" class="diff">
        <template v-for="(t, i) in diff" :key="i"><span :class="t.ok ? 'ok' : 'bad'">{{ t.text }}</span>{{ ' ' }}</template>
      </p>

      <div class="natural">
        <div class="muted small">Cách nói tự nhiên</div>
        <div class="row">
          <b class="grow">{{ result.natural }}</b>
          <button class="btn ghost" aria-label="Nghe" @click="speak(result.natural)">🔊</button>
        </div>
      </div>

      <p class="expl">{{ result.explanation }}</p>
      <p v-if="current.note" class="note">💡 {{ current.note }}</p>

      <details v-if="current.alt?.length" class="alts">
        <summary>Các cách nói khác</summary>
        <ul>
          <li v-for="a in [current.en, ...current.alt]" :key="a">{{ a }}</li>
        </ul>
      </details>

      <button class="btn primary block" @click="next">{{ index + 1 >= queue.length ? 'Hoàn thành' : 'Câu tiếp theo' }}</button>
    </section>
  </template>

  <section v-else-if="phase === 'done'" class="card done">
    <h1>Xong lượt luyện! 🎊</h1>
    <div class="sum">
      <div><b>{{ tally.perfect }}</b><span class="muted">tuyệt vời</span></div>
      <div><b>{{ tally.good }}</b><span class="muted">gần đúng</span></div>
      <div><b>{{ tally.wrong }}</b><span class="muted">cần ôn lại</span></div>
    </div>
    <p class="muted">🔥 Chuỗi hiện tại: {{ store.streak.value }} ngày · Hôm nay: {{ store.today.value }} câu</p>
    <div class="row">
      <NuxtLink to="/" class="btn grow">Về trang chủ</NuxtLink>
      <button class="btn primary grow" @click="$router.go(0)">Luyện tiếp</button>
    </div>
  </section>
</template>

<style scoped>
.top { margin: 8px 0 14px; }
.bar { height: 10px; background: var(--soft); border-radius: 99px; overflow: hidden; }
.bar i { display: block; height: 100%; background: var(--accent); transition: width .3s; }
.between { justify-content: space-between; }
.q { display: flex; flex-direction: column; gap: 12px; margin-bottom: 14px; }
.vi { font-size: 1.35rem; font-weight: 600; margin: 0; line-height: 1.4; }
.time { font-variant-numeric: tabular-nums; font-weight: 700; }
.time.late { color: var(--bad); }
.timebar { height: 6px; background: var(--soft); border-radius: 99px; overflow: hidden; }
.timebar i { display: block; height: 100%; background: var(--good); transition: width .1s linear; }
.timebar i.late { background: var(--bad); }
.actions .btn { flex-shrink: 0; }
.actions .grow { flex: 1 1 140px; }
.checking { text-align: center; padding: 8px; }
.res { display: flex; flex-direction: column; gap: 12px; }
.res.perfect { background: var(--good-bg); border-color: var(--good); }
.res.good { background: var(--warn-bg); border-color: var(--warn); }
.res.wrong { background: var(--bad-bg); border-color: var(--bad); }
.diff { margin: 0; font-size: 1.05rem; }
.diff .ok { color: var(--good); }
.diff .bad { color: var(--bad); text-decoration: line-through; text-decoration-thickness: 2px; }
.natural b { font-size: 1.1rem; }
.small { font-size: .8rem; }
.expl, .note { margin: 0; }
.tag { font-size: .75rem; padding: 2px 8px; border-radius: 99px; background: var(--soft); }
.alts { font-size: .95rem; }
.alts summary { cursor: pointer; color: var(--muted); }
.alts ul { margin: 6px 0 0; padding-left: 20px; }
.done { text-align: center; display: flex; flex-direction: column; gap: 14px; margin-top: 40px; }
.sum { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.sum b { display: block; font-size: 1.8rem; }
</style>
