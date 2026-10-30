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

// Left = the Vietnamese sentence. Right = your English answer with the correction right below it.
type Msg =
  | { id: number; kind: 'note'; text: string }
  | { id: number; kind: 'resume'; pos: number }
  | { id: number; kind: 'prompt'; sentence: Sentence }
  | { id: number; kind: 'typing' }
  | { id: number; kind: 'user'; text: string; muted?: boolean; sentence: Sentence; pending: boolean; result?: CheckResult }
  | { id: number; kind: 'summary'; perfect: number; good: number; wrong: number }

type Mode = 'intro' | 'answer' | 'busy' | 'done'

const msgs = ref<Msg[]>([])
const mode = ref<Mode>('busy')
const idx = ref(0)
const text = ref('')
const tally = reactive({ perfect: 0, good: 0, wrong: 0 })
let uid = 0
let alive = true
let interacted = false
const composer = ref<HTMLTextAreaElement>()
const bar = ref<HTMLElement>()

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const n = computed(() => list.value.length)
const shown = computed(() => (mode.value === 'done' ? n.value : Math.min(n.value, idx.value + 1)))
const progress = computed(() => (mode.value === 'done' ? 100 : (idx.value / Math.max(1, n.value)) * 100))

function scrollDown() {
  if (!import.meta.client) return
  nextTick(() => requestAnimationFrame(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })))
}

function push(m: Omit<Msg, 'id'>): Msg {
  const msg = { ...m, id: ++uid } as Msg
  msgs.value.push(msg)
  scrollDown()
  return msgs.value[msgs.value.length - 1]! // the reactive proxy, so later edits re-render
}
const drop = (id: number) => (msgs.value = msgs.value.filter((m) => m.id !== id))

function focusComposer() {
  if (interacted) nextTick(() => composer.value?.focus({ preventScroll: true }))
}

async function ask(i: number) {
  mode.value = 'busy'
  const wait = push({ kind: 'typing' })
  await delay(i === 0 ? 650 : 500)
  drop(wait.id)
  if (!alive) return
  idx.value = i
  push({ kind: 'prompt', sentence: list.value[i]! })
  mode.value = 'answer'
  focusComposer()
}

function start() {
  const pos = store.state.value.chatPos[topicId.value] ?? 0
  if (pos > 0 && pos < n.value) {
    push({ kind: 'resume', pos })
    mode.value = 'intro'
  } else {
    push({ kind: 'note', text: `${n.value} ${n.value === 1 ? 'sentence' : 'sentences'} · in order` })
    ask(0)
  }
}

function resume(pos: number) {
  msgs.value = msgs.value.filter((m) => m.kind !== 'resume')
  push({ kind: 'note', text: `Continuing from ${pos + 1} of ${n.value}` })
  ask(pos)
}

function restart() {
  msgs.value = []
  tally.perfect = tally.good = tally.wrong = 0
  idx.value = 0
  text.value = ''
  store.setChatPos(topicId.value, 0)
  push({ kind: 'note', text: `${n.value} ${n.value === 1 ? 'sentence' : 'sentences'} · in order` })
  ask(0)
}

async function askRestart() {
  if (msgs.value.length > 4) {
    const ok = await confirm.ask({ title: 'Start over?', message: 'The conversation restarts from the first sentence. Your scores are kept.', confirmText: 'Start over', destructive: false })
    if (!ok) return
  }
  restart()
}

/** Show the correction under the answer, record the score, then bring in the next Vietnamese sentence. */
async function settle(msg: Extract<Msg, { kind: 'user' }>, res: CheckResult) {
  const v = verdictOf(res)
  tally[v]++
  store.grade(msg.sentence.id, v === 'perfect' ? 2 : v === 'good' ? 1 : 0)
  msg.result = res
  msg.pending = false
  scrollDown()
  await delay(1100)
  if (alive) next()
}

async function send() {
  const s = list.value[idx.value]
  const t = text.value.trim()
  if (!s || !t || mode.value !== 'answer') return
  interacted = true
  text.value = ''
  resizeComposer()
  mode.value = 'busy'
  const msg = push({ kind: 'user', text: t, sentence: s, pending: true }) as Extract<Msg, { kind: 'user' }>
  const res = await checker.check(s, t)
  if (alive) settle(msg, res)
}

function peekAnswer() {
  const s = list.value[idx.value]
  if (!s || mode.value !== 'answer') return
  interacted = true
  mode.value = 'busy'
  const msg = push({ kind: 'user', text: 'Show answer', muted: true, sentence: s, pending: true }) as Extract<Msg, { kind: 'user' }>
  delay(300).then(() => alive && settle(msg, checker.peek(s)))
}

function next() {
  stopSpeaking()
  const i = idx.value + 1
  if (i >= n.value) {
    store.setChatPos(topicId.value, 0)
    mode.value = 'done'
    push({ kind: 'summary', perfect: tally.perfect, good: tally.good, wrong: tally.wrong })
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

const canType = computed(() => mode.value === 'answer')
const placeholder = computed(() => (mode.value === 'answer' ? 'Type your answer in English…' : mode.value === 'intro' ? 'Choose an option above…' : ' '))

// The composer is pinned to the bottom of the *visible* area through CSS variables set by plugins/viewport.client.ts
// (--kb = height of the keyboard covering the layout viewport). When the viewport changes, keep the newest message in view.
const barH = ref(96)
let ro: ResizeObserver | undefined
const onViewport = () => scrollDown()

onMounted(() => {
  if (!topic.value || !list.value.length) return router.replace(topic.value ? { path: '/learn', query: { t: topic.value.id } } : '/')
  window.visualViewport?.addEventListener('resize', onViewport)
  if (bar.value && 'ResizeObserver' in window) {
    ro = new ResizeObserver(() => (barH.value = bar.value?.offsetHeight ?? 96))
    ro.observe(bar.value)
  }
  start()
})
onBeforeUnmount(() => {
  alive = false
  stopSpeaking()
  window.visualViewport?.removeEventListener('resize', onViewport)
  ro?.disconnect()
})
</script>

<template>
  <template v-if="topic && list.length">
    <header class="nav cnav">
      <NuxtLink :to="{ path: '/learn', query: { t: topic.id } }" class="icon-btn" aria-label="Close chat"><AppIcon name="x" :size="18" /></NuxtLink>
      <span class="title">{{ topic.emoji }} {{ topic.label }}</span>
      <span class="count" aria-label="Progress">{{ shown }}/{{ n }}</span>
      <button class="icon-btn" aria-label="Start over" @click="askRestart"><AppIcon name="repeat" :size="18" /></button>
      <div class="prog" role="progressbar" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="Math.round(progress)"><i :style="{ width: progress + '%' }" /></div>
    </header>

    <main class="thread" :style="{ paddingBottom: `calc(${barH}px + var(--kb, 0px) + 24px)` }" aria-live="polite">
      <TransitionGroup name="msg" tag="div" class="msgs">
        <div v-for="m in msgs" :key="m.id" class="m" :class="[m.kind, m.kind === 'user' ? 'mine' : m.kind === 'note' ? 'center' : 'theirs']">
          <div v-if="m.kind === 'note'" class="pillnote">{{ m.text }}</div>

          <div v-else-if="m.kind === 'resume'" class="bubble">
            Continue from <b>{{ m.pos + 1 }}</b> of {{ n }}?
            <div class="choices">
              <button class="btn primary" @click="resume(m.pos)">Continue</button>
              <button class="btn" @click="restart">Start over</button>
            </div>
          </div>

          <div v-else-if="m.kind === 'prompt'" class="bubble ask" lang="vi">{{ m.sentence.vi }}</div>

          <div v-else-if="m.kind === 'typing'" class="bubble dots" aria-label="Typing"><i /><i /><i /></div>

          <div v-else-if="m.kind === 'user'" class="col">
            <div class="bubble" :class="{ muted: m.muted }">{{ m.text }}</div>
            <div v-if="m.pending" class="bubble dots wait" aria-label="Checking"><i /><i /><i /></div>
            <div v-else-if="m.result" class="fbcard"><ChatFeedback :answer="m.text" :result="m.result" :uid="m.id" /></div>
          </div>

          <div v-else-if="m.kind === 'summary'" class="bubble sum">
            <b class="sum-t">Done 🎉</b>
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

    <footer v-if="mode !== 'done'" ref="bar" class="composer">
      <div v-if="mode === 'answer'" class="quick">
        <button class="qbtn" @click="peekAnswer">👀 Show answer</button>
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
.cnav .title { text-align: left; }
.count { font-size: .85rem; font-weight: 700; color: var(--muted); font-variant-numeric: tabular-nums; }
.prog { flex: 0 0 100%; height: 3px; margin: 0 -16px; background: color-mix(in srgb, var(--accent) 14%, transparent); }
.prog i { display: block; height: 100%; background: var(--accent); transition: width .4s ease; border-radius: 0 3px 3px 0; }

.thread { padding-top: 14px; }
.msgs { display: flex; flex-direction: column; gap: 10px; }
.m { display: flex; width: 100%; }
.m.theirs { justify-content: flex-start; }
.m.mine { justify-content: flex-end; }
.m.center { justify-content: center; }

.bubble { max-width: min(86%, 440px); padding: 10px 14px; border-radius: 20px; line-height: 1.4; overflow-wrap: anywhere; }
.theirs .bubble { background: var(--card); border: 1px solid var(--line); border-bottom-left-radius: 6px; box-shadow: var(--shadow); }
.ask { font-size: 1.12rem; font-weight: 700; line-height: 1.35; }

/* right side: your answer, with the correction card right below it */
.col { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; max-width: min(90%, 460px); }
.col .bubble { max-width: 100%; background: var(--accent); color: #fff; border-bottom-right-radius: 6px; box-shadow: 0 4px 12px color-mix(in srgb, var(--accent) 30%, transparent); }
.col .bubble.muted { background: var(--soft); color: var(--muted); box-shadow: none; font-style: italic; }
.col .bubble.wait { background: var(--card); border: 1px solid var(--line); box-shadow: none; border-top-right-radius: 6px; border-bottom-right-radius: 20px; }
.fbcard { align-self: stretch; padding: 12px 12px 12px 14px; border-radius: 18px; border-top-right-radius: 6px; background: var(--card); border: 1px solid var(--line); box-shadow: var(--shadow); }
.pillnote { font-size: .78rem; color: var(--muted); background: var(--soft); padding: 5px 12px; border-radius: 99px; }

.dots { display: flex; gap: 5px; align-items: center; padding: 14px 16px; width: fit-content; }
.dots i { width: 7px; height: 7px; border-radius: 50%; background: var(--muted); opacity: .45; animation: bounce 1s ease-in-out infinite; }
.dots i:nth-child(2) { animation-delay: .15s; }
.dots i:nth-child(3) { animation-delay: .3s; }
@keyframes bounce { 0%, 60%, 100% { transform: translateY(0); opacity: .4; } 30% { transform: translateY(-5px); opacity: 1; } }

.choices { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
.choices .btn { min-height: 44px; padding: 0 16px; text-decoration: none; }
.sum { display: flex; flex-direction: column; gap: 8px; width: min(92%, 440px); }
.sum-t { font-size: 1.1rem; }
.sum-n { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.sum-n span { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 8px 4px; border-radius: 12px; background: var(--soft); font-size: .72rem; color: var(--muted); text-align: center; line-height: 1.15; }
.sum-n b { font-size: 1.5rem; color: var(--ink); line-height: 1.1; }
.sum-n b.g { color: var(--good); }
.sum-n b.r { color: var(--bad); }

.msg-enter-active { transition: transform .28s cubic-bezier(.2, .8, .2, 1), opacity .22s; }
.msg-enter-from { opacity: 0; transform: translateY(10px) scale(.98); }
@media (prefers-reduced-motion: reduce) { .msg-enter-active { transition: none; } .dots i { animation: none; } }

.composer { position: fixed; left: 0; right: 0; bottom: var(--kb, 0px); z-index: 15; padding: 8px 12px calc(10px + env(safe-area-inset-bottom) * (1 - var(--kb-open, 0))); background: color-mix(in srgb, var(--bg) 88%, transparent); backdrop-filter: blur(16px) saturate(1.4); border-top: 1px solid var(--line); }
.composer > * { max-width: 536px; margin-left: auto; margin-right: auto; }
.quick { display: flex; gap: 8px; margin-bottom: 8px; }
.qbtn { appearance: none; border: 1px solid var(--line); background: var(--card); color: var(--ink); font: inherit; font-weight: 650; font-size: .9rem; min-height: 44px; padding: 0 14px; border-radius: 99px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; }
.input { display: flex; align-items: flex-end; gap: 8px; }
.input textarea { flex: 1; min-height: 44px; max-height: 132px; padding: 11px 14px; border-radius: 22px; line-height: 1.35; overflow-y: auto; }
.input textarea:disabled { opacity: .6; }
.send { flex: none; width: 44px; height: 44px; border-radius: 50%; border: 0; padding: 0; background: var(--accent); color: #fff; display: grid; place-items: center; cursor: pointer; transition: transform .1s, opacity .15s; }
.send:active:not(:disabled) { transform: scale(.92); }
.send:disabled { opacity: .35; cursor: default; }
.send :deep(svg) { transform: translate(-1px, 1px); }
</style>
