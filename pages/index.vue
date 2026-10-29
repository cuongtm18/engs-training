<script setup lang="ts">
import sentences from '~/data/sentences.json'
import type { Sentence } from '~/utils/types'

const store = useStore()
const router = useRouter()

const all = sentences as Sentence[]
const topics = ref<string[]>(TOPICS.map((t) => t.id))
const levels = ref<number[]>([1, 2, 3])

function toggle<T>(list: Ref<T[]>, v: T) {
  list.value = list.value.includes(v) ? list.value.filter((x) => x !== v) : [...list.value, v]
}

const pool = computed(() => all.filter((s) => topics.value.includes(s.t) && levels.value.includes(s.l)))
const dueCount = computed(() => {
  const now = Date.now()
  return pool.value.filter((s) => {
    const c = store.state.value.cards[s.id]
    return c && c.due <= now
  }).length
})
const newCount = computed(() => pool.value.filter((s) => !store.state.value.cards[s.id]).length)

function start() {
  router.push({ path: '/practice', query: { t: topics.value.join(','), l: levels.value.join(',') } })
}
</script>

<template>
  <header class="head">
    <div>
      <h1>Phản xạ tiếng Anh</h1>
      <div class="muted">Thấy câu Việt → nói ngay câu Anh</div>
    </div>
    <NuxtLink to="/settings" class="gear" aria-label="Cài đặt">⚙️</NuxtLink>
  </header>

  <section class="stats">
    <div class="card stat"><b>🔥 {{ store.streak.value }}</b><span class="muted">ngày liên tiếp</span></div>
    <div class="card stat"><b>{{ store.today.value }}</b><span class="muted">câu hôm nay</span></div>
    <div class="card stat"><b>{{ store.learned.value }}</b><span class="muted">câu đã thuộc</span></div>
  </section>

  <section class="card block">
    <h2>Chủ đề</h2>
    <div class="row wrap">
      <button v-for="t in TOPICS" :key="t.id" class="chip" :class="{ on: topics.includes(t.id) }" @click="toggle(topics, t.id)">
        {{ t.emoji }} {{ t.label }}
      </button>
    </div>
    <h2 style="margin-top: 16px">Độ khó</h2>
    <div class="row wrap">
      <button v-for="l in LEVELS" :key="l.id" class="chip" :class="{ on: levels.includes(l.id) }" @click="toggle(levels, l.id)">
        {{ l.label }}
      </button>
    </div>
  </section>

  <p class="muted info">
    <template v-if="pool.length">{{ dueCount }} câu cần ôn · {{ newCount }} câu mới</template>
    <template v-else>Hãy chọn ít nhất một chủ đề và một mức độ.</template>
  </p>

  <button class="btn primary block" :disabled="!pool.length" @click="start">Bắt đầu luyện ({{ store.state.value.settings.sessionSize }} câu)</button>
</template>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: flex-start; margin: 8px 0 18px; }
.gear { font-size: 1.5rem; text-decoration: none; padding: 6px; }
.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px; }
.stat { display: flex; flex-direction: column; align-items: center; padding: 12px 6px; text-align: center; }
.stat b { font-size: 1.3rem; }
.stat span { font-size: .78rem; }
.block { margin-bottom: 8px; }
.info { text-align: center; margin: 12px 0; }
</style>
