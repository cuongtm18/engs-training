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
      <button class="icon-btn" aria-label="New topic" @click="openNew"><AppIcon name="plus" :size="20" /></button>
    </div>
  </header>

  <NuxtLink v-if="totalDue && !editMode" :to="{ path: '/practice', query: { t: 'all' } }" class="review">
    <span class="rv-ic"><AppIcon name="repeat" :size="20" /></span>
    <span class="grow"><b>Review {{ totalDue }} due {{ totalDue === 1 ? 'sentence' : 'sentences' }}</b><span class="rv-sub">Practice what you are about to forget</span></span>
    <AppIcon name="chevron-left" :size="18" class="chev" />
  </NuxtLink>

  <p v-if="editMode" class="muted hint">Tap a topic to edit or remove it.</p>

  <section class="grid">
    <div v-for="t in rows" :key="t.id" class="tile" :class="{ wiggle: editMode }" :style="{ '--c': TOPIC_COLORS[t.color ?? 0] }">
      <button
        class="hit"
        :aria-label="`${editMode ? 'Edit' : 'Open'} ${t.label}`"
        @pointerdown="pressStart(t)"
        @pointerup="pressEnd"
        @pointerleave="pressEnd"
        @pointercancel="pressEnd"
        @contextmenu.prevent
        @click="open(t)"
      />
      <div class="top">
        <span class="emoji">{{ t.emoji }}</span>
        <span class="tr">
          <span v-if="t.due && !editMode" class="due">{{ t.due }} due</span>
          <span v-if="t.total" class="ring"><ProgressRing :value="t.done / t.total" :size="34" :stroke="4" :color="TOPIC_COLORS[t.color ?? 0]" /></span>
        </span>
      </div>
      <div class="foot">
        <div class="txt">
          <b class="name">{{ t.label }}</b>
          <span class="meta">{{ t.total }} {{ t.total === 1 ? 'sentence' : 'sentences' }}</span>
        </div>
        <NuxtLink v-if="t.total && !editMode" :to="{ path: '/practice', query: { t: t.id } }" class="play" :aria-label="`Practice ${t.label}`">
          <AppIcon name="play" :size="16" />
        </NuxtLink>
      </div>
      <span v-if="editMode" class="badge" aria-hidden="true"><AppIcon name="edit" :size="13" :stroke="2.4" /></span>
    </div>

    <div class="tile new">
      <button class="hit" aria-label="New topic" @click="openNew" />
      <span class="plus"><AppIcon name="plus" :size="26" /></span>
      <b>New topic</b>
      <span class="meta">Then let AI write the first script</span>
    </div>
  </section>

  <TopicSheet v-model="sheetOpen" :topic="sheetTopic" @saved="onSaved" />
</template>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; margin: 8px 0 14px; }
.text-btn { appearance: none; border: 0; background: none; color: var(--accent); font: inherit; font-weight: 650; padding: 8px 6px; cursor: pointer; }

.review { display: flex; align-items: center; gap: 12px; padding: 12px 16px 12px 12px; margin-bottom: 14px; border-radius: 20px; background: var(--accent); color: #fff; text-decoration: none; box-shadow: 0 6px 18px color-mix(in srgb, var(--accent) 35%, transparent); }
.rv-ic { flex: none; width: 40px; height: 40px; border-radius: 12px; background: rgba(255, 255, 255, .22); display: grid; place-items: center; }
.rv-sub { display: block; font-size: .82rem; color: rgba(255, 255, 255, .88); }
.chev { transform: rotate(180deg); opacity: .85; }
.hint { margin: 0 0 10px; text-align: center; }

/* Grid: every tile has the same height, content is laid out with flex so nothing is positioned by guesswork. */
.grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: 150px; gap: 12px; }
.tile { position: relative; display: flex; flex-direction: column; justify-content: space-between; padding: 14px; min-width: 0; border-radius: 22px; color: var(--ink);
  border: 1px solid color-mix(in srgb, var(--c) 30%, var(--line)); background: color-mix(in srgb, var(--c) 13%, var(--card)); box-shadow: var(--shadow); transition: transform .12s; }
.tile:has(.hit:active) { transform: scale(.97); }
.hit { position: absolute; inset: 0; z-index: 1; width: 100%; border: 0; padding: 0; background: transparent; border-radius: inherit; cursor: pointer; }

.top, .foot { position: relative; display: flex; justify-content: space-between; pointer-events: none; }
.top { align-items: center; height: 40px; }
.emoji { width: 40px; height: 40px; margin-left: -4px; display: grid; place-items: center; font-size: 1.9rem; line-height: 1; }
.tr { display: flex; align-items: center; gap: 8px; }
.ring { width: 34px; height: 34px; display: grid; place-items: center; }
.ring :deep(svg) { display: block; }
.due { font-size: .72rem; font-weight: 750; line-height: 1; padding: 5px 8px; border-radius: 99px; background: var(--accent); color: #fff; white-space: nowrap; }

.foot { align-items: flex-end; gap: 8px; }
.txt { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.name { font-size: .95rem; letter-spacing: -.01em; line-height: 1.2; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.meta { font-size: .78rem; line-height: 1.2; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.play { pointer-events: auto; z-index: 2; flex: none; width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; color: #fff; background: var(--c); text-decoration: none; box-shadow: 0 4px 10px color-mix(in srgb, var(--c) 40%, transparent); transition: transform .1s; }
/* a play triangle looks centred when nudged slightly right */
.play :deep(svg) { transform: translateX(1px); }
.play:active { transform: scale(.9); }

.badge { position: absolute; top: -7px; left: -7px; z-index: 2; width: 26px; height: 26px; border-radius: 50%; background: var(--ink); color: var(--bg); display: grid; place-items: center; pointer-events: none; }

.new { align-items: center; justify-content: center; gap: 4px; text-align: center; border: 2px dashed var(--line); background: transparent; box-shadow: none; }
.new > b, .new > .meta, .new > .plus { position: relative; pointer-events: none; }
.new .meta { white-space: normal; }
.plus { width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center; color: var(--accent); background: var(--soft); }

.wiggle { animation: wiggle .28s infinite alternate ease-in-out; }
.wiggle:nth-child(2n) { animation-delay: -.14s; }
@keyframes wiggle { from { transform: rotate(-.9deg); } to { transform: rotate(.9deg); } }
@media (prefers-reduced-motion: reduce) { .wiggle { animation: none; } }
</style>
