<script setup lang="ts">
import type { Sentence } from '~/utils/types'

const route = useRoute()
const router = useRouter()
const store = useStore()
const undo = useUndo()
const { byTopic } = useSentences()
const topics = useTopics()

const topicId = computed(() => String(route.query.t ?? ''))
const topic = computed(() => topics.byId(topicId.value))
const list = computed(() => byTopic(topicId.value))
const color = computed(() => TOPIC_COLORS[topic.value?.color ?? 0])

const hideEn = ref(false)

// --- reorder: press and hold a card, then drag it ---
const listEl = ref<HTMLElement>()
function commitOrder(ids: string[]) {
  const restore = store.setOrder(topicId.value, ids)
  undo.push({ message: 'Order changed', undo: restore })
}
const reorder = useReorder({ container: listEl, ids: () => list.value.map((s) => s.id), onCommit: commitOrder })
const hasCustomOrder = computed(() => !!store.state.value.sentenceOrder[topicId.value]?.length)
function resetOrder() {
  const restore = store.setOrder(topicId.value, null)
  undo.push({ message: 'Default order restored', undo: restore })
}
// keyboard alternative: Alt + ↑ / ↓ moves the focused sentence
function moveBy(id: string, e: KeyboardEvent) {
  if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return
  e.preventDefault()
  const ids = list.value.map((s) => s.id)
  const i = ids.indexOf(id)
  const j = i + (e.key === 'ArrowUp' ? -1 : 1)
  if (j < 0 || j >= ids.length) return
  ;[ids[i], ids[j]] = [ids[j]!, ids[i]!]
  commitOrder(ids)
  nextTick(() => document.getElementById(`s-${id}`)?.querySelector<HTMLElement>('article')?.focus())
}
const revealed = reactive<Record<string, boolean>>({})
const addOpen = ref(false)
const editOpen = ref(false)

function onAdded(added: Sentence[]) {
  const ids = added.map((s) => s.id)
  undo.push({ message: `${added.length} ${added.length === 1 ? 'sentence' : 'sentences'} added`, undo: () => store.removeSentences(ids) })
  // new sentences are appended to the end of the list: bring them into view
  nextTick(() => document.getElementById(`s-${ids[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
}

// No confirm dialog: swiping and tapping Delete is already two steps, and the toast offers Undo.
function remove(s: Sentence) {
  const restore = store.removeSentence(s.id)
  undo.push({ message: 'Sentence deleted', undo: restore })
}

onMounted(() => {
  // a brand-new or empty topic opens straight on the AI script sheet
  if (topic.value && (route.query.add || !list.value.length)) addOpen.value = true
})
onBeforeUnmount(() => stopSpeaking())
</script>

<template>
  <template v-if="topic">
    <header class="nav">
      <NuxtLink to="/" class="icon-btn" aria-label="Back to topics"><AppIcon name="chevron-left" :size="20" /></NuxtLink>
      <span class="title row"><TopicIcon :emoji="topic.emoji" :icon="topic.icon" :size="22" /> {{ topic.label }}</span>
      <button class="icon-btn" aria-label="Edit topic" @click="editOpen = true"><AppIcon name="edit" :size="18" /></button>
    </header>

    <section class="hero" :style="{ '--c': color }">
      <TopicIcon :emoji="topic.emoji" :icon="topic.icon" :size="46" />
      <div class="grow">
        <b>{{ list.length }} {{ list.length === 1 ? 'sentence' : 'sentences' }}</b>
        <div class="muted small">Learn them here, then practice</div>
      </div>
    </section>

    <div v-if="list.length" class="row actions">
      <NuxtLink :to="{ path: '/chat', query: { t: topic.id } }" class="btn primary grow"><AppIcon name="chat" :size="18" /> Chat practice</NuxtLink>
      <NuxtLink :to="{ path: '/practice', query: { t: topic.id } }" class="btn grow"><AppIcon name="edit" :size="18" /> Quick practice</NuxtLink>
    </div>
    <p v-if="list.length" class="muted small modes">Chat goes through your list in order, like a conversation. Press and hold a sentence, then drag it to change the order.</p>
    <button class="btn block addbtn" @click="addOpen = true"><AppIcon name="plus" :size="18" /> Add sentences</button>

    <button v-if="list.length" class="row bar" role="switch" :aria-checked="hideEn" @click="hideEn = !hideEn">
      <span class="grow">Hide English</span>
      <span class="switch" :class="{ on: hideEn }" aria-hidden="true"><i /></span>
    </button>

    <div v-else class="empty">
      <div class="big">🌱</div>
      <b>No sentences yet</b>
      <p class="muted">Let AI write a starter script, or paste your own list.</p>
      <button class="btn primary" @click="addOpen = true">✨ Add sentences</button>
    </div>

    <section ref="listEl" class="list" :class="{ dragging: reorder.active.value }" @touchstart.passive="reorder.onTouchStart" @mousedown="reorder.onMouseDown">
      <SwipeRow
        v-for="s in list"
        :id="`s-${s.id}`"
        :key="s.id"
        :data-sid="s.id"
        :disabled="!s.custom"
        :frozen="reorder.active.value"
        :class="{ lifted: reorder.draggingId.value === s.id }"
        :style="reorder.itemStyle(s.id)"
        @action="remove(s)"
      >
        <article class="card item" tabindex="0" :aria-label="`${s.en}. Press Alt and the up or down arrow to move.`" @keydown="moveBy(s.id, $event)">
          <div class="row">
            <button v-if="hideEn && !revealed[s.id]" class="peek grow" @click="revealed[s.id] = true">Tap to show the English</button>
            <b v-else class="en grow">{{ s.en }}</b>
            <SpeakButton :id="s.id" :text="s.en" class="small-ic" />
          </div>
          <div class="vi" lang="vi">{{ s.vi }}</div>
          <template v-if="!hideEn || revealed[s.id]">
            <div v-if="s.alt?.length" class="chips"><span v-for="a in s.alt" :key="a" class="alt">{{ a }}</span></div>
            <p v-if="s.note" class="note">💡 {{ s.note }}</p>
          </template>
        </article>
      </SwipeRow>
    </section>
    <p v-if="list.length > 1 && (hasCustomOrder || list.some((s) => s.custom))" class="muted small tip">
      <template v-if="list.some((s) => s.custom)">Swipe your own sentences to the left to delete them.</template>
      <button v-if="hasCustomOrder" class="linkbtn" @click="resetOrder">Reset order</button>
    </p>

    <AddSentencesSheet v-model="addOpen" :topic="topic" :existing="list" @saved="onAdded" />
    <TopicSheet v-model="editOpen" :topic="topic" @deleted="router.replace('/')" />

  </template>

  <section v-else class="card">
    <p>Topic not found.</p>
    <NuxtLink to="/" class="btn">Back to topics</NuxtLink>
  </section>
</template>

<style scoped>
.hero { display: flex; align-items: center; gap: 14px; padding: 16px; margin-bottom: 12px; border-radius: 22px; background: color-mix(in srgb, var(--c) 14%, var(--card)); border: 1px solid color-mix(in srgb, var(--c) 32%, var(--line)); }
.hero .em { font-size: 2.4rem; }
.actions { margin-bottom: 8px; }
.modes { margin: 0 4px 10px; text-align: center; }
.addbtn { margin-bottom: 12px; }
.actions .btn { flex: 1 1 0; padding: 0 10px; white-space: nowrap; font-size: .95rem; }
.bar { width: 100%; min-height: 48px; padding: 0 6px; margin-bottom: 6px; background: none; border: 0; font: inherit; color: var(--ink); text-align: left; cursor: pointer; }
.switch { display: block; flex: none; width: 51px; height: 31px; border-radius: 99px; background: var(--line); position: relative; cursor: pointer; transition: background .2s; padding: 0; }
.switch i { position: absolute; top: 2px; left: 2px; width: 27px; height: 27px; border-radius: 50%; background: #fff; box-shadow: 0 2px 5px rgba(0, 0, 0, .25); transition: transform .2s; }
.switch.on { background: var(--good); }
.switch.on i { transform: translateX(20px); }
.empty { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 34px 12px; }
.empty .big { font-size: 3rem; }
.empty p { margin: 0 0 8px; }
.list { display: flex; flex-direction: column; gap: 10px; }
.item { display: flex; flex-direction: column; gap: 8px; padding: 14px; box-shadow: none; }
.en { font-size: 1.08rem; line-height: 1.35; }
.vi { color: var(--muted); }
.peek { appearance: none; border: 1px dashed var(--line); background: transparent; color: var(--muted); border-radius: 12px; padding: 10px; font: inherit; cursor: pointer; text-align: left; }
.small-ic { flex-shrink: 0; margin: -4px -4px -4px 0; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.alt { font-size: .85rem; padding: 4px 10px; border-radius: 99px; background: var(--soft); }
.note { margin: 0; font-size: .92rem; }
.tip { text-align: center; margin: 14px 0 0; }
.linkbtn { appearance: none; border: 0; background: none; color: var(--accent); font: inherit; font-weight: 650; cursor: pointer; padding: 10px 8px; margin: -6px 0 -10px; display: block; margin-inline: auto; }
.list.dragging { user-select: none; -webkit-user-select: none; }
.list.dragging :deep(*) { cursor: grabbing; }
.item { -webkit-touch-callout: none; user-select: none; -webkit-user-select: none; }
.item:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
</style>
