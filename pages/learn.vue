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
const revealed = reactive<Record<string, boolean>>({})
const addOpen = ref(false)
const editOpen = ref(false)

function onAdded(added: Sentence[]) {
  const ids = added.map((s) => s.id)
  undo.push({ message: `${added.length} ${added.length === 1 ? 'sentence' : 'sentences'} added`, undo: () => store.removeSentences(ids) })
}

// No confirm dialog: swiping and tapping Delete is already two steps, and the toast offers Undo.
function remove(s: Sentence) {
  const restore = store.removeSentence(s.id)
  undo.push({ message: 'Sentence deleted', undo: restore })
}

function speak(text: string) {
  if (!('speechSynthesis' in window)) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'en-US'
  u.rate = 0.95
  speechSynthesis.speak(u)
}

onMounted(() => {
  // a brand-new or empty topic opens straight on the AI script sheet
  if (topic.value && (route.query.add || !list.value.length)) addOpen.value = true
})
onBeforeUnmount(() => {
  if (import.meta.client && 'speechSynthesis' in window) speechSynthesis.cancel()
})
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

    <div class="row actions">
      <NuxtLink v-if="list.length" :to="{ path: '/practice', query: { t: topic.id } }" class="btn primary grow"><AppIcon name="edit" :size="18" /> Practice</NuxtLink>
      <button class="btn grow" @click="addOpen = true"><AppIcon name="plus" :size="18" /> Add sentences</button>
    </div>

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

    <section class="list">
      <SwipeRow v-for="s in list" :key="s.id" :disabled="!s.custom" @action="remove(s)">
        <article class="card item">
          <div class="row">
            <button v-if="hideEn && !revealed[s.id]" class="peek grow" @click="revealed[s.id] = true">Tap to show the English</button>
            <b v-else class="en grow">{{ s.en }}</b>
            <button class="icon-btn small-ic" aria-label="Listen" @click="speak(s.en)"><AppIcon name="volume" :size="18" /></button>
          </div>
          <div class="vi" lang="vi">{{ s.vi }}</div>
          <template v-if="!hideEn || revealed[s.id]">
            <div v-if="s.alt?.length" class="chips"><span v-for="a in s.alt" :key="a" class="alt">{{ a }}</span></div>
            <p v-if="s.note" class="note">💡 {{ s.note }}</p>
          </template>
        </article>
      </SwipeRow>
    </section>
    <p v-if="list.some((s) => s.custom)" class="muted small tip">Tip: swipe your own sentences to the left to delete them.</p>

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
.actions { margin-bottom: 12px; }
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
.small-ic { box-shadow: none; flex-shrink: 0; margin: -4px -4px -4px 0; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.alt { font-size: .85rem; padding: 4px 10px; border-radius: 99px; background: var(--soft); }
.note { margin: 0; font-size: .92rem; }
.tip { text-align: center; margin: 14px 0 0; }
</style>
