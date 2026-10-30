<script setup lang="ts">
import type { CheckResult, Sentence } from '~/utils/types'

const route = useRoute()
const store = useStore()
const api = useApi()
const undo = useUndo()
const { all } = useSentences()
const topics = useTopics()
const settings = computed(() => store.state.value.settings)

type Phase = 'answer' | 'checking' | 'result' | 'done'

const queue = ref<Sentence[]>([])
const index = ref(0)
const phase = ref<Phase>('answer')
const answer = ref('')
const result = ref<CheckResult | null>(null)
const requeued = new Set<string>()
const tally = reactive({ perfect: 0, good: 0, wrong: 0 })
const input = ref<HTMLTextAreaElement>()

const current = computed(() => queue.value[index.value])
const topic = computed(() => topics.byId(String(route.query.t ?? '')))
const verdict = computed(() => (result.value ? verdictOf(result.value) : 'wrong'))

function build() {
  const t = String(route.query.t ?? 'all')
  const pool = all.value.filter((s) => t === 'all' || s.t === t)
  const now = Date.now()
  const cards = store.state.value.cards
  const size = settings.value.sessionSize
  const due = shuffle(pool.filter((s) => cards[s.id] && cards[s.id]!.due <= now))
  const fresh = shuffle(pool.filter((s) => !cards[s.id]))
  const picked = due.slice(0, size)
  picked.push(...fresh.slice(0, Math.min(size - picked.length, settings.value.dailyNew)))
  // chưa đủ thì lấy thêm các câu chưa tới hạn để luôn có bài luyện
  if (picked.length < size) {
    const rest = shuffle(pool.filter((s) => !picked.includes(s)))
    picked.push(...rest.slice(0, size - picked.length))
  }
  queue.value = shuffle(picked)
}

function clearAnswer() {
  const prev = answer.value
  if (!prev) return
  answer.value = ''
  input.value?.focus()
  if (prev.trim().length >= 3) {
    undo.push({
      message: 'Text cleared',
      undo: () => {
        answer.value = prev
        input.value?.focus()
      },
    })
  }
}

function beginCard() {
  answer.value = ''
  result.value = null
  phase.value = 'answer'
  nextTick(() => input.value?.focus())
}

function offlineResult(s: Sentence, text: string, reason: string): CheckResult {
  const ratio = overlapRatio(text, s)
  const ok = ratio >= 0.7
  return {
    structureOk: ok,
    naturalness: ok ? Math.round(ratio * 100) : 0,
    natural: s.en,
    explanation: `${reason} App chỉ ước lượng bằng cách so với câu mẫu nên điểm chỉ mang tính tham khảo.`,
    engine: 'offline',
  }
}

async function submit() {
  const s = current.value
  const text = answer.value.trim()
  if (!s || !text || phase.value !== 'answer') return

  if (matchesAny(text, s)) {
    finish({ structureOk: true, naturalness: 100, natural: text, explanation: 'Chuẩn rồi! Câu này đúng và nghe rất tự nhiên.', engine: 'local' })
    return
  }

  phase.value = 'checking'
  const ck = hashKey('v3', s.id, text)
  const cached = store.state.value.cache[ck]
  if (cached) return finish(cached)

  try {
    const res = await api.check(s, text)
    store.state.value.cache[ck] = res
    finish(res)
  } catch (e) {
    finish(offlineResult(s, text, errorDetail(e)))
  }
}

function finish(res: CheckResult) {
  const s = current.value!
  // Guard (also covers results cached by older versions): the natural version must be English.
  if (hasVietnamese(res.natural)) res = { ...res, natural: s.en }
  result.value = res
  phase.value = 'result'
  const v = verdictOf(res)
  tally[v]++
  store.grade(s.id, v === 'perfect' ? 2 : v === 'good' ? 1 : 0)
  if (v === 'wrong' && !requeued.has(s.id)) {
    requeued.add(s.id)
    queue.value.push(s)
  }
}

function reveal() {
  const s = current.value
  if (!s || phase.value !== 'answer') return
  finish({ structureOk: false, naturalness: 0, natural: s.en, explanation: 'Bạn đã xem đáp án. Câu này sẽ quay lại sớm để ôn.', engine: 'local' })
}

function next() {
  if (index.value + 1 >= queue.value.length) {
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

onMounted(() => {
  build()
  if (!queue.value.length) return navigateTo('/')
  beginCard()
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  if (import.meta.client && 'speechSynthesis' in window) speechSynthesis.cancel()
})

const title = { perfect: 'Tuyệt vời! 🎉', good: 'Đúng rồi, nói tự nhiên hơn nữa nhé 👍', wrong: 'Chưa đúng, thử lại nhé 💪' }
const levelText = (n: number) => (n >= 90 ? 'Như người bản xứ' : n >= 70 ? 'Khá tự nhiên' : n >= 40 ? 'Hơi gượng' : 'Cần chỉnh nhiều')
</script>

<template>
  <template v-if="phase !== 'done' && current">
    <header class="nav">
      <NuxtLink to="/" class="icon-btn" aria-label="Exit"><AppIcon name="x" :size="18" /></NuxtLink>
      <div class="bar grow"><i :style="{ width: ((index + (phase === 'result' ? 1 : 0)) / queue.length) * 100 + '%' }" /></div>
      <span class="muted count">{{ index + 1 }}/{{ queue.length }}</span>
    </header>

    <section class="card q">
      <span class="crumb muted"><span class="ct"><template v-if="topic"><TopicIcon :emoji="topic.emoji" :icon="topic.icon" :size="16" /> {{ topic.label }}</template><template v-else>Review</template></span><span class="cn">Sentence {{ index + 1 }}</span></span>
      <p class="vi" lang="vi">{{ current.vi }}</p>

      <textarea
        ref="input"
        v-model="answer"
        rows="3"
        placeholder="Type your English sentence…"
        autocapitalize="sentences"
        autocomplete="off"
        autocorrect="off"
        spellcheck="false"
        :readonly="phase !== 'answer'"
      />

      <div v-if="phase === 'answer'" class="actions">
        <button class="btn primary check" :disabled="!answer.trim()" @click="submit">Check</button>
        <button class="btn" @click="reveal">Show answer</button>
        <button class="btn ghost" :disabled="!answer" @click="clearAnswer">Clear</button>
      </div>
      <div v-else-if="phase === 'checking'" class="muted checking">Checking your answer…</div>
    </section>

    <section v-if="phase === 'result' && result" class="card res" :class="verdict">
      <div class="row between">
        <h2>{{ title[verdict] }}</h2>
        <span v-if="result.engine === 'offline'" class="tag">offline</span>
      </div>

      <div class="step">
        <div class="row">
          <span class="dot" :class="result.structureOk ? 'ok' : 'no'"><AppIcon :name="result.structureOk ? 'check' : 'x'" :size="18" :stroke="3" /></span>
          <div class="grow">
            <b>Bước 1 · Cấu trúc và ý nghĩa</b>
            <div class="muted small">{{ result.structureOk ? 'Đúng cấu trúc, đủ ý' : 'Chưa đúng cấu trúc hoặc chưa đủ ý' }}</div>
          </div>
        </div>
      </div>

      <div class="step" :class="{ locked: !result.structureOk }">
        <div class="row">
          <span class="dot" :class="result.structureOk ? (result.naturalness >= 85 ? 'ok' : 'mid') : 'lock'"><template v-if="result.structureOk">%</template><AppIcon v-else name="lock" :size="17" /></span>
          <div class="grow">
            <b>Bước 2 · Độ tự nhiên<template v-if="result.structureOk"> · {{ result.naturalness }}%</template></b>
            <div v-if="result.structureOk" class="meter"><i :style="{ width: result.naturalness + '%' }" :class="result.naturalness >= 85 ? 'hi' : result.naturalness >= 50 ? 'mid' : 'lo'" /></div>
            <div class="muted small">{{ result.structureOk ? levelText(result.naturalness) : 'Sửa cấu trúc trước, rồi mới chấm độ tự nhiên' }}</div>
          </div>
        </div>
      </div>

      <div class="natural">
        <div class="muted small">Cách nói tự nhiên</div>
        <div class="row">
          <b class="grow">{{ result.natural }}</b>
          <button class="btn ghost listen" aria-label="Listen" @click="speak(result.natural)"><AppIcon name="volume" :size="20" /></button>
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

      <button class="btn primary block" @click="next">{{ index + 1 >= queue.length ? 'Finish' : 'Next sentence' }}</button>
    </section>
  </template>

  <section v-else-if="phase === 'done'" class="card done">
    <h1>Round complete! 🎊</h1>
    <div class="sum">
      <div><b>{{ tally.perfect }}</b><span class="muted">rất tự nhiên</span></div>
      <div><b>{{ tally.good }}</b><span class="muted">cần tự nhiên hơn</span></div>
      <div><b>{{ tally.wrong }}</b><span class="muted">cần ôn lại</span></div>
    </div>
    <p class="muted">🔥 Streak: {{ store.streak.value }} {{ store.streak.value === 1 ? 'day' : 'days' }} · Today: {{ store.today.value }} answered</p>
    <div class="row">
      <NuxtLink to="/" class="btn grow">Home</NuxtLink>
      <button class="btn primary grow" @click="$router.go(0)">Practice more</button>
    </div>
  </section>
</template>

<style scoped>
.count { font-variant-numeric: tabular-nums; min-width: 38px; text-align: right; }
.bar { height: 10px; background: var(--soft); border-radius: 99px; overflow: hidden; }
.bar i { display: block; height: 100%; background: var(--accent); transition: width .3s; }
.between { justify-content: space-between; }
.q { display: flex; flex-direction: column; gap: 12px; margin-bottom: 14px; margin-top: 6px; }
.vi { font-size: 1.35rem; font-weight: 600; margin: 0; line-height: 1.4; }
.crumb { display: flex; gap: 6px; min-width: 0; font-size: .92rem; }
.crumb .ct { flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.crumb .cn { flex: none; white-space: nowrap; }
.crumb .cn::before { content: '·'; margin-right: 6px; }
.actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.actions .check { grid-column: 1 / -1; }
.checking { text-align: center; padding: 8px; }
.res { display: flex; flex-direction: column; gap: 12px; }
.res.perfect { background: var(--good-bg); border-color: var(--good); }
.res.good { background: var(--warn-bg); border-color: var(--warn); }
.res.wrong { background: var(--bad-bg); border-color: var(--bad); }
.step { display: flex; flex-direction: column; gap: 6px; }
.step.locked { opacity: .65; }
.dot { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; font-weight: 700; flex-shrink: 0; background: var(--soft); }
.dot.ok { background: var(--good); color: #fff; }
.dot.no { background: var(--bad); color: #fff; }
.dot.mid { background: var(--warn); color: #fff; }
.dot.lock { background: var(--soft); color: var(--muted); }
.meter { height: 8px; background: var(--soft); border-radius: 99px; overflow: hidden; margin: 6px 0 4px; }
.meter i { display: block; height: 100%; border-radius: 99px; transition: width .4s; }
.meter i.hi { background: var(--good); }
.meter i.mid { background: var(--warn); }
.meter i.lo { background: var(--bad); }
.natural b { font-size: 1.1rem; }
.listen { min-width: 48px; padding: 0; }
.small { font-size: .8rem; }
.expl, .note { margin: 0; }
.tag { font-size: .75rem; padding: 2px 8px; border-radius: 99px; background: var(--soft); }
.alts { font-size: .95rem; }
.alts summary { cursor: pointer; color: var(--muted); padding: 12px 0; margin: -6px 0; }
.alts ul { margin: 6px 0 0; padding-left: 20px; }
.done { text-align: center; display: flex; flex-direction: column; gap: 16px; margin-top: 12vh; padding: 22px 18px; }
.sum { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.sum > div { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 12px 4px; border-radius: 16px; background: var(--soft); }
.sum b { display: block; font-size: 1.9rem; line-height: 1.1; }
.sum > div:nth-child(1) b { color: var(--good); }
.sum > div:nth-child(3) b { color: var(--bad); }
.sum span { font-size: .78rem; line-height: 1.2; }
</style>
