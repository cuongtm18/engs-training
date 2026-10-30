<script setup lang="ts">
import type { CheckResult, Sentence } from '~/utils/types'

const route = useRoute()
const router = useRouter()
const store = useStore()
const checker = useAnswerCheck()
const confirm = useConfirm()
const { byTopic } = useSentences()
const topics = useTopics()

const topicId = computed(() => String(route.query.t ?? ''))
const topic = computed(() => topics.byId(topicId.value))
const list = computed(() => byTopic(topicId.value))

type Msg =
  | { id: number; kind: 'hello'; count: number }
  | { id: number; kind: 'resume'; pos: number }
  | { id: number; kind: 'note'; text: string }
  | { id: number; kind: 'prompt'; sentence: Sentence; n: number }
  | { id: number; kind: 'user'; text: string; muted?: boolean }
  | { id: number; kind: 'typing' }
  | { id: number; kind: 'reply'; sentence: Sentence; result: CheckResult; praise: string }
  | { id: number; kind: 'summary'; perfect: number; good: number; wrong: number; praise: string }

type Mode = 'intro' | 'answer' | 'busy' | 'next' | 'done'

const msgs = ref<Msg[]>([])
const mode = ref<Mode>('busy')
const idx = ref(0)
const text = ref('')
const tally = reactive({ perfect: 0, good: 0, wrong: 0 })
const attempts = new Map<string, number>()
let combo = 0
let uid = 0
let alive = true
let interacted = false
const composer = ref<HTMLTextAreaElement>()
const bar = ref<HTMLElement>()

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const n = computed(() => list.value.length)
const progress = computed(() => (mode.value === 'done' ? 100 : ((idx.value + (mode.value === 'next' ? 1 : 0)) / Math.max(1, n.value)) * 100))

function scrollDown() {
  if (!import.meta.client) return
  nextTick(() => requestAnimationFrame(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })))
}

function push(m: Omit<Msg, 'id'>): number {
  const id = ++uid
  msgs.value.push({ ...m, id } as Msg)
  scrollDown()
  return id
}
const drop = (id: number) => (msgs.value = msgs.value.filter((m) => m.id !== id))

async function typing(ms: number) {
  const id = push({ kind: 'typing' })
  await delay(ms)
  drop(id)
}

function focusComposer() {
  if (interacted) nextTick(() => composer.value?.focus({ preventScroll: true }))
}

async function ask(i: number) {
  mode.value = 'busy'
  await typing(i === 0 ? 700 : 550)
  if (!alive) return
  idx.value = i
  push({ kind: 'prompt', sentence: list.value[i]!, n: i + 1 })
  mode.value = 'answer'
  focusComposer()
}

async function begin(from: number) {
  if (from === 0) push({ kind: 'hello', count: n.value })
  await ask(from)
}

function start() {
  const pos = store.state.value.chatPos[topicId.value] ?? 0
  if (pos > 0 && pos < n.value) {
    push({ kind: 'resume', pos })
    mode.value = 'intro'
  } else begin(0)
}

function resume(pos: number) {
  msgs.value = msgs.value.filter((m) => m.kind !== 'resume')
  push({ kind: 'note', text: `Continuing from sentence ${pos + 1} of ${n.value}` })
  begin(pos)
}

function restart() {
  msgs.value = []
  tally.perfect = tally.good = tally.wrong = 0
  attempts.clear()
  combo = 0
  idx.value = 0
  text.value = ''
  store.setChatPos(topicId.value, 0)
  begin(0)
}

async function askRestart() {
  if (msgs.value.length > 4) {
    const ok = await confirm.ask({ title: 'Start over?', message: 'The conversation restarts from the first sentence. Your scores are kept.', confirmText: 'Start over', destructive: false })
    if (!ok) return
  }
  restart()
}

function deliver(s: Sentence, res: CheckResult, peekOnly = false) {
  const first = (attempts.get(s.id) ?? 0) === 0
  attempts.set(s.id, (attempts.get(s.id) ?? 0) + 1)
  const v = verdictOf(res)
  let line: string
  if (first) {
    tally[v]++
    combo = res.structureOk ? combo + 1 : 0
    store.grade(s.id, v === 'perfect' ? 2 : v === 'good' ? 1 : 0) // only the first attempt counts towards spaced repetition
  }
  if (peekOnly) line = pickPraise('peek')
  else if (v === 'perfect') line = (first ? comboPraise(combo) : null) ?? pickPraise(res.engine === 'local' ? 'exact' : 'perfect')
  else line = pickPraise(v)
  push({ kind: 'reply', sentence: s, result: res, praise: line })
  if (v === 'perfect' && !peekOnly) {
    mode.value = 'busy'
    delay(1100).then(() => alive && next())
  } else {
    mode.value = 'next'
    focusComposer()
  }
}

async function send() {
  const s = list.value[idx.value]
  const t = text.value.trim()
  if (mode.value === 'next' && !t) return next()
  if (!s || !t || (mode.value !== 'answer' && mode.value !== 'next')) return
  interacted = true
  text.value = ''
  resizeComposer()
  push({ kind: 'user', text: t })
  mode.value = 'busy'
  const wait = push({ kind: 'typing' })
  const res = await checker.check(s, t)
  if (!alive) return
  drop(wait)
  deliver(s, res)
}

function peekAnswer() {
  const s = list.value[idx.value]
  if (!s || mode.value !== 'answer') return
  interacted = true
  push({ kind: 'user', text: 'Show me the answer', muted: true })
  mode.value = 'busy'
  delay(350).then(() => alive && deliver(s, checker.peek(s), true))
}

function next() {
  stopSpeaking()
  const i = idx.value + 1
  if (i >= n.value) {
    store.setChatPos(topicId.value, 0)
    mode.value = 'done'
    push({ kind: 'summary', perfect: tally.perfect, good: tally.good, wrong: tally.wrong, praise: donePraise(tally.perfect + tally.good, tally.perfect + tally.good + tally.wrong) })
    return
  }
  store.setChatPos(topicId.value, i)
  ask(i)
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    send()
  }
}

function resizeComposer() {
  const el = composer.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 132) + 'px'
}

const canType = computed(() => mode.value === 'answer' || mode.value === 'next')
const placeholder = computed(() => (mode.value === 'next' ? 'Try again, or tap Next…' : mode.value === 'answer' ? 'Type your answer in English…' : mode.value === 'intro' ? 'Choose an option above…' : ' '))

// The composer is fixed to the bottom of the *visible* area, so it stays above the iOS keyboard.
const inset = ref(0)
const barH = ref(96)
let vv: VisualViewport | null = null
let ro: ResizeObserver | undefined
function syncViewport() {
  inset.value = vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0
  scrollDown()
}

onMounted(() => {
  if (!topic.value || !list.value.length) return router.replace(topic.value ? { path: '/learn', query: { t: topic.value.id } } : '/')
  vv = window.visualViewport
  vv?.addEventListener('resize', syncViewport)
  vv?.addEventListener('scroll', syncViewport)
  if (bar.value && 'ResizeObserver' in window) {
    ro = new ResizeObserver(() => (barH.value = bar.value?.offsetHeight ?? 96))
    ro.observe(bar.value)
  }
  start()
})
onBeforeUnmount(() => {
  alive = false
  stopSpeaking()
  vv?.removeEventListener('resize', syncViewport)
  vv?.removeEventListener('scroll', syncViewport)
  ro?.disconnect()
})
</script>

<template>
  <template v-if="topic && list.length">
    <header class="nav cnav">
      <NuxtLink :to="{ path: '/learn', query: { t: topic.id } }" class="icon-btn" aria-label="Close chat"><AppIcon name="x" :size="18" /></NuxtLink>
      <span class="title">{{ topic.emoji }} {{ topic.label }}</span>
      <button class="icon-btn" aria-label="Start over" @click="askRestart"><AppIcon name="repeat" :size="18" /></button>
      <div class="prog" role="progressbar" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="Math.round(progress)"><i :style="{ width: progress + '%' }" /></div>
    </header>

    <main class="thread" :style="{ paddingBottom: barH + inset + 24 + 'px' }" aria-live="polite">
      <TransitionGroup name="msg" tag="div" class="msgs">
        <div v-for="m in msgs" :key="m.id" class="m" :class="[m.kind, m.kind === 'user' ? 'mine' : m.kind === 'note' ? 'center' : 'theirs']">
          <span v-if="m.kind !== 'user' && m.kind !== 'note'" class="avatar" aria-hidden="true">{{ topic.emoji }}</span>

          <div v-if="m.kind === 'hello'" class="bubble">
            Hi! 👋 I'll send you <b>{{ m.count }}</b> Vietnamese {{ m.count === 1 ? 'sentence' : 'sentences' }}, one by one, in the order of your list. Reply in English, like a real chat.
          </div>

          <div v-else-if="m.kind === 'resume'" class="bubble">
            Welcome back! You stopped at sentence <b>{{ m.pos + 1 }}</b> of {{ n }}.
            <div class="choices">
              <button class="btn primary" @click="resume(m.pos)">Continue</button>
              <button class="btn" @click="restart">Start over</button>
            </div>
          </div>

          <div v-else-if="m.kind === 'note'" class="pillnote">{{ m.text }}</div>

          <div v-else-if="m.kind === 'prompt'" class="bubble ask">
            <span class="tag">Sentence {{ m.n }} of {{ n }} · translate to English</span>
            <span class="vi" lang="vi">{{ m.sentence.vi }}</span>
          </div>

          <div v-else-if="m.kind === 'user'" class="bubble" :class="{ muted: m.muted }">{{ m.text }}</div>

          <div v-else-if="m.kind === 'typing'" class="bubble dots" aria-label="Typing"><i /><i /><i /></div>

          <div v-else-if="m.kind === 'reply'" class="bubble reply-b">
            <ChatReply :result="m.result" :praise="m.praise" :sentence="m.sentence" :uid="m.id" />
          </div>

          <div v-else-if="m.kind === 'summary'" class="bubble sum">
            <b class="sum-t">Conversation complete! 🎊</b>
            <p class="sum-p">{{ m.praise }}</p>
            <div class="sum-n">
              <span><b class="g">{{ m.perfect }}</b>rất tự nhiên</span>
              <span><b>{{ m.good }}</b>cần tự nhiên hơn</span>
              <span><b class="r">{{ m.wrong }}</b>cần ôn lại</span>
            </div>
            <div class="choices">
              <button class="btn primary" @click="restart">Chat again</button>
              <NuxtLink :to="{ path: '/learn', query: { t: topic.id } }" class="btn">Back to topic</NuxtLink>
            </div>
          </div>
        </div>
      </TransitionGroup>
    </main>

    <footer v-if="mode !== 'done'" ref="bar" class="composer" :style="{ bottom: inset + 'px', paddingBottom: inset ? '10px' : 'calc(10px + env(safe-area-inset-bottom))' }">
      <div v-if="mode === 'answer' || mode === 'next'" class="quick">
        <button v-if="mode === 'answer'" class="qbtn" @click="peekAnswer">👀 Show answer</button>
        <button v-else class="qbtn primary" @click="next">Next sentence <AppIcon name="chevron-left" :size="16" class="flip" /></button>
      </div>
      <div class="input">
        <textarea
          ref="composer"
          v-model="text"
          rows="1"
          :disabled="!canType"
          :placeholder="placeholder"
          autocapitalize="sentences"
          autocomplete="off"
          autocorrect="off"
          spellcheck="false"
          enterkeyhint="send"
          @keydown="onKey"
          @input="resizeComposer"
          @focus="interacted = true"
        />
        <button class="send" :disabled="!canType || !text.trim()" aria-label="Send" @click="send"><AppIcon name="send" :size="20" /></button>
      </div>
    </footer>
  </template>
</template>

<style scoped>
.cnav { flex-wrap: wrap; row-gap: 8px; padding-bottom: 0; }
.prog { flex: 0 0 100%; height: 3px; margin: 0 -16px; background: color-mix(in srgb, var(--accent) 14%, transparent); }
.prog i { display: block; height: 100%; background: var(--accent); transition: width .4s ease; border-radius: 0 3px 3px 0; }

.thread { padding-top: 12px; }
.msgs { display: flex; flex-direction: column; gap: 10px; }
.m { display: flex; align-items: flex-end; gap: 8px; width: 100%; }
.m.mine { flex-direction: row-reverse; }
.m.center { justify-content: center; }
.avatar { flex: none; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; font-size: 1rem; background: var(--soft); margin-bottom: 2px; }

.bubble { max-width: min(86%, 440px); padding: 10px 14px; border-radius: 20px; line-height: 1.4; word-break: break-word; }
.theirs .bubble { background: var(--card); border: 1px solid var(--line); border-bottom-left-radius: 6px; box-shadow: var(--shadow); }
.mine .bubble { background: var(--accent); color: #fff; border-bottom-right-radius: 6px; max-width: min(82%, 420px); box-shadow: 0 4px 12px color-mix(in srgb, var(--accent) 30%, transparent); }
.mine .bubble.muted { background: var(--soft); color: var(--muted); box-shadow: none; font-style: italic; }
.ask { display: flex; flex-direction: column; gap: 4px; }
.tag { font-size: .72rem; color: var(--muted); font-weight: 650; }
.vi { font-size: 1.12rem; font-weight: 700; line-height: 1.35; }
.reply-b { width: min(92%, 460px); max-width: 100%; }
.bubble.reply-b { padding: 12px; }
.pillnote { font-size: .78rem; color: var(--muted); background: var(--soft); padding: 5px 12px; border-radius: 99px; }

.dots { display: flex; gap: 5px; align-items: center; padding: 14px 16px; }
.dots i { width: 7px; height: 7px; border-radius: 50%; background: var(--muted); opacity: .45; animation: bounce 1s ease-in-out infinite; }
.dots i:nth-child(2) { animation-delay: .15s; }
.dots i:nth-child(3) { animation-delay: .3s; }
@keyframes bounce { 0%, 60%, 100% { transform: translateY(0); opacity: .4; } 30% { transform: translateY(-5px); opacity: 1; } }

.choices { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
.choices .btn { min-height: 44px; padding: 0 16px; text-decoration: none; }
.sum { display: flex; flex-direction: column; gap: 6px; width: min(92%, 460px); }
.sum-t { font-size: 1.1rem; }
.sum-p { margin: 0; font-weight: 650; text-wrap: balance; }
.sum-n { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 4px; }
.sum-n span { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 4px; border-radius: 12px; background: var(--soft); font-size: .72rem; color: var(--muted); text-align: center; line-height: 1.15; }
.sum-n b { font-size: 1.5rem; color: var(--ink); line-height: 1.1; }
.sum-n b.g { color: var(--good); }
.sum-n b.r { color: var(--bad); }

.msg-enter-active { transition: transform .28s cubic-bezier(.2, .8, .2, 1), opacity .22s; }
.msg-enter-from { opacity: 0; transform: translateY(10px) scale(.98); }
@media (prefers-reduced-motion: reduce) { .msg-enter-active { transition: none; } .dots i { animation: none; } }

.composer { position: fixed; left: 0; right: 0; z-index: 15; padding: 8px 12px 10px; background: color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter: blur(16px) saturate(1.4); border-top: 1px solid var(--line); }
.composer > * { max-width: 536px; margin-left: auto; margin-right: auto; }
.quick { display: flex; gap: 8px; margin-bottom: 8px; }
.qbtn { appearance: none; border: 1px solid var(--line); background: var(--card); color: var(--ink); font: inherit; font-weight: 650; font-size: .9rem; min-height: 44px; padding: 0 14px; border-radius: 99px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; }
.qbtn.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.flip { transform: rotate(180deg); }
.input { display: flex; align-items: flex-end; gap: 8px; }
.input textarea { flex: 1; min-height: 44px; max-height: 132px; padding: 11px 14px; border-radius: 22px; line-height: 1.35; overflow-y: auto; }
.input textarea:disabled { opacity: .6; }
.send { flex: none; width: 44px; height: 44px; border-radius: 50%; border: 0; padding: 0; background: var(--accent); color: #fff; display: grid; place-items: center; cursor: pointer; transition: transform .1s, opacity .15s; }
.send:active:not(:disabled) { transform: scale(.92); }
.send:disabled { opacity: .35; cursor: default; }
.send :deep(svg) { transform: translate(-1px, 1px); }
</style>
