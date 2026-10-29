<script setup lang="ts">
import type { Sentence } from '~/utils/types'

const route = useRoute()
const router = useRouter()
const store = useStore()
const confirm = useConfirm()
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
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined

function showToast(msg: string) {
  toast.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 2200)
}

function onAdded(n: number) {
  showToast(`${n} ${n === 1 ? 'sentence' : 'sentences'} added`)
  navigator.vibrate?.(10)
}

async function remove(s: Sentence) {
  const ok = await confirm.ask({ title: 'Delete this sentence?', message: s.en, confirmText: 'Delete' })
  if (ok) store.removeSentence(s.id)
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
  clearTimeout(toastTimer)
  if (import.meta.client && 'speechSynthesis' in window) speechSynthesis.cancel()
})
</script>

<template>
  <template v-if="topic">
    <header class="nav">
      <NuxtLink to="/" class="icon-btn" aria-label="Back to topics">‹</NuxtLink>
      <span class="title">{{ topic.emoji }} {{ topic.label }}</span>
      <button class="icon-btn" aria-label="Edit topic" @click="editOpen = true">✎</button>
    </header>

    <section class="hero" :style="{ '--c': color }">
      <span class="em">{{ topic.emoji }}</span>
      <div class="grow">
        <b>{{ list.length }} {{ list.length === 1 ? 'sentence' : 'sentences' }}</b>
        <div class="muted small">Learn them here, then practice</div>
      </div>
    </section>

    <div class="row actions">
      <NuxtLink v-if="list.length" :to="{ path: '/practice', query: { t: topic.id } }" class="btn primary grow">✍️ Practice</NuxtLink>
      <button class="btn grow" @click="addOpen = true">＋ Add sentences</button>
    </div>

    <div v-if="list.length" class="row bar">
      <span class="grow">Hide English</span>
      <button class="switch" :class="{ on: hideEn }" role="switch" :aria-checked="hideEn" aria-label="Hide English" @click="hideEn = !hideEn"><i /></button>
    </div>

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
            <button class="icon-btn small-ic" aria-label="Listen" @click="speak(s.en)">🔊</button>
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

    <Transition name="toast"><div v-if="toast" class="toast" role="status">{{ toast }}</div></Transition>
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
.actions .btn { flex: 1 1 0; }
.bar { padding: 4px 6px 10px; }
.switch { appearance: none; border: 0; width: 51px; height: 31px; border-radius: 99px; background: var(--line); position: relative; cursor: pointer; transition: background .2s; padding: 0; }
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
.small-ic { width: 38px; height: 38px; box-shadow: none; flex-shrink: 0; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.alt { font-size: .85rem; padding: 4px 10px; border-radius: 99px; background: var(--soft); }
.note { margin: 0; font-size: .92rem; }
.tip { text-align: center; margin: 14px 0 0; }
.toast { position: fixed; left: 50%; bottom: calc(28px + env(safe-area-inset-bottom)); transform: translateX(-50%); z-index: 70; background: var(--ink); color: var(--bg); padding: 11px 18px; border-radius: 99px; font-weight: 650; box-shadow: 0 8px 24px rgba(0, 0, 0, .3); }
.toast-enter-active, .toast-leave-active { transition: opacity .2s, transform .25s; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, 14px); }
</style>
