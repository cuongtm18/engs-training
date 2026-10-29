<script setup lang="ts">
import type { Topic } from '~/utils/types'

const store = useStore()
const router = useRouter()
const { all } = useSentences()
const topics = useTopics()

const now = Date.now()
const rows = computed(() =>
  topics.all.value.map((t) => {
    const list = all.value.filter((s) => s.t === t.id)
    const due = list.filter((s) => (store.state.value.cards[s.id]?.due ?? Infinity) <= now).length
    const done = list.filter((s) => (store.state.value.cards[s.id]?.box ?? 0) >= 3).length
    return { ...t, total: list.length, due, done }
  }),
)
const totalDue = computed(() => rows.value.reduce((n, r) => n + r.due, 0))

// --- edit mode + topic sheet ---
const editMode = ref(false)
const sheetOpen = ref(false)
const sheetTopic = ref<Topic>()

function openNew() {
  sheetTopic.value = undefined
  sheetOpen.value = true
}
function openEdit(t: Topic) {
  sheetTopic.value = t
  sheetOpen.value = true
}
function onSaved(t: Topic) {
  // a brand-new topic opens straight on its screen so you can generate a script
  if (!sheetTopic.value) router.push({ path: '/learn', query: { t: t.id, add: '1' } })
}

let pressTimer: ReturnType<typeof setTimeout> | undefined
let pressed = false
function pressStart(t: Topic) {
  pressed = false
  pressTimer = setTimeout(() => {
    pressed = true
    navigator.vibrate?.(14)
    openEdit(t)
  }, 520)
}
function pressEnd() {
  clearTimeout(pressTimer)
}
function open(t: Topic) {
  if (pressed) return (pressed = false)
  if (editMode.value) openEdit(t)
  else router.push({ path: '/learn', query: { t: t.id } })
}
</script>

<template>
  <header class="head">
    <h1 class="large-title">Topics</h1>
    <div class="row">
      <button class="text-btn" @click="editMode = !editMode">{{ editMode ? 'Done' : 'Edit' }}</button>
      <button class="icon-btn" aria-label="New topic" @click="openNew">＋</button>
    </div>
  </header>

  <NuxtLink v-if="totalDue && !editMode" :to="{ path: '/practice', query: { t: 'all' } }" class="review">
    <span class="bolt">🔁</span>
    <span class="grow"><b>Review {{ totalDue }} due {{ totalDue === 1 ? 'sentence' : 'sentences' }}</b><br /><span class="muted small">Practice what you are about to forget</span></span>
    <span aria-hidden="true">›</span>
  </NuxtLink>

  <p v-if="editMode" class="muted hint">Tap a topic to edit or remove it.</p>

  <section class="grid">
    <div v-for="t in rows" :key="t.id" class="tile-wrap" :class="{ wiggle: editMode }">
      <button
        class="tile"
        :style="{ '--c': TOPIC_COLORS[t.color ?? 0] }"
        @pointerdown="pressStart(t)"
        @pointerup="pressEnd"
        @pointerleave="pressEnd"
        @pointercancel="pressEnd"
        @contextmenu.prevent
        @click="open(t)"
      >
        <span class="top">
          <span class="emoji">{{ t.emoji }}</span>
          <span v-if="t.total" class="ring"><ProgressRing :value="t.total ? t.done / t.total : 0" :size="34" :stroke="4" :color="TOPIC_COLORS[t.color ?? 0]" /></span>
        </span>
        <b class="name">{{ t.label }}</b>
        <span class="meta muted">
          {{ t.total }} {{ t.total === 1 ? 'sentence' : 'sentences' }}<template v-if="t.due"> · <span class="due">{{ t.due }} due</span></template>
        </span>
      </button>
      <span v-if="editMode" class="badge" aria-hidden="true">✎</span>
      <NuxtLink v-else-if="t.total" :to="{ path: '/practice', query: { t: t.id } }" class="play" :style="{ background: TOPIC_COLORS[t.color ?? 0] }" :aria-label="`Practice ${t.label}`">▶</NuxtLink>
    </div>

    <button class="tile new" @click="openNew">
      <span class="plus">＋</span>
      <b>New topic</b>
      <span class="muted small">Then let AI write the first script</span>
    </button>
  </section>

  <TopicSheet v-model="sheetOpen" :topic="sheetTopic" @saved="onSaved" />
</template>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; margin: 8px 0 14px; }
.text-btn { appearance: none; border: 0; background: none; color: var(--accent); font: inherit; font-weight: 650; padding: 8px 6px; cursor: pointer; }
.review { display: flex; align-items: center; gap: 12px; padding: 14px 16px; margin-bottom: 14px; border-radius: 20px; background: var(--accent); color: #fff; text-decoration: none; box-shadow: 0 6px 18px color-mix(in srgb, var(--accent) 35%, transparent); }
.review .muted { color: rgba(255, 255, 255, .85); }
.bolt { font-size: 1.5rem; }
.hint { margin: 0 0 10px; text-align: center; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.tile-wrap { position: relative; }
.tile { position: relative; width: 100%; min-height: 138px; display: flex; flex-direction: column; align-items: stretch; gap: 4px; text-align: left; padding: 14px; border-radius: 22px; cursor: pointer; font: inherit; color: var(--ink); border: 1px solid color-mix(in srgb, var(--c) 30%, var(--line)); background: color-mix(in srgb, var(--c) 13%, var(--card)); box-shadow: var(--shadow); transition: transform .12s; }
.tile:active { transform: scale(.97); }
.top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: auto; }
.emoji { font-size: 2rem; line-height: 1.1; }
.name { font-size: 1.02rem; line-height: 1.2; padding-right: 36px; }
.meta { font-size: .8rem; padding-right: 36px; }
.due { color: var(--accent); font-weight: 700; }
.play { position: absolute; right: 12px; bottom: 12px; width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; color: #fff; text-decoration: none; font-size: .8rem; padding-left: 2px; box-shadow: 0 4px 10px rgba(0, 0, 0, .18); transition: transform .1s; }
.play:active { transform: scale(.9); }
.badge { position: absolute; top: -6px; left: -6px; width: 26px; height: 26px; border-radius: 50%; background: var(--ink); color: var(--bg); display: grid; place-items: center; font-size: .8rem; pointer-events: none; }
.new { align-items: center; justify-content: center; text-align: center; border: 2px dashed var(--line); background: transparent; box-shadow: none; }
.plus { font-size: 1.8rem; color: var(--accent); }
.wiggle .tile { animation: wiggle .28s infinite alternate ease-in-out; }
.wiggle:nth-child(2n) .tile { animation-delay: -.14s; }
@keyframes wiggle { from { transform: rotate(-.9deg); } to { transform: rotate(.9deg); } }
@media (prefers-reduced-motion: reduce) { .wiggle .tile { animation: none; } }
</style>
