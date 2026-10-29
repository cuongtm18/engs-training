<script setup lang="ts">
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

// --- new topic ---
const EMOJIS = ['📚', '🍽️', '✈️', '🏨', '🏥', '🏦', '🎓', '🛒', '💻', '🎬', '⚽', '🎤']
const creating = ref(false)
const name = ref('')
const emoji = ref('📚')

function create() {
  if (!name.value.trim()) return
  const t = store.addTopic(name.value, emoji.value)
  name.value = ''
  creating.value = false
  router.push({ path: '/learn', query: { t: t.id } })
}
</script>

<template>
  <header class="head">
    <div>
      <h1>English Reflex</h1>
      <div class="muted">Learn the sentences, then train your reflexes</div>
    </div>
    <NuxtLink to="/settings" class="gear" aria-label="Settings">⚙️</NuxtLink>
  </header>

  <section class="stats">
    <div class="card stat"><b>🔥 {{ store.streak.value }}</b><span class="muted">day streak</span></div>
    <div class="card stat"><b>{{ store.today.value }}</b><span class="muted">answered today</span></div>
    <div class="card stat"><b>{{ store.learned.value }}</b><span class="muted">sentences learned</span></div>
  </section>

  <NuxtLink v-if="totalDue" :to="{ path: '/practice', query: { t: 'all' } }" class="btn primary block review">
    🔁 Review {{ totalDue }} due {{ totalDue === 1 ? 'sentence' : 'sentences' }}
  </NuxtLink>

  <section class="topics">
    <div v-for="t in rows" :key="t.id" class="card topic">
      <div class="row">
        <span class="emoji">{{ t.emoji }}</span>
        <div class="grow">
          <b>{{ t.label }}</b>
          <div class="muted small">
            {{ t.total }} {{ t.total === 1 ? 'sentence' : 'sentences' }}<template v-if="t.done"> · {{ t.done }} learned</template><template v-if="t.due"> · {{ t.due }} due</template>
          </div>
        </div>
      </div>
      <div class="row modes">
        <NuxtLink :to="{ path: '/learn', query: { t: t.id } }" class="btn grow">📖 Learn</NuxtLink>
        <NuxtLink v-if="t.total" :to="{ path: '/practice', query: { t: t.id } }" class="btn primary grow">✍️ Practice</NuxtLink>
        <span v-else class="btn grow disabled">✍️ Practice</span>
      </div>
    </div>

    <div class="card topic">
      <button v-if="!creating" class="btn block" @click="creating = true">＋ New topic</button>
      <template v-else>
        <h2>New topic</h2>
        <input v-model="name" maxlength="40" placeholder="Topic name, e.g. Job interview" @keydown.enter.prevent="create" />
        <div class="row wrap emojis">
          <button v-for="e in EMOJIS" :key="e" class="chip" :class="{ on: emoji === e }" @click="emoji = e">{{ e }}</button>
        </div>
        <div class="row">
          <button class="btn ghost" @click="creating = false">Cancel</button>
          <button class="btn primary grow" :disabled="!name.trim()" @click="create">Create topic</button>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: flex-start; margin: 8px 0 18px; }
.gear { font-size: 1.5rem; text-decoration: none; padding: 6px; }
.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 14px; }
.stat { display: flex; flex-direction: column; align-items: center; padding: 12px 6px; text-align: center; }
.stat b { font-size: 1.3rem; }
.stat span { font-size: .78rem; }
.review { display: block; text-align: center; text-decoration: none; margin-bottom: 14px; padding-top: 13px; }
.topics { display: flex; flex-direction: column; gap: 10px; }
.topic { display: flex; flex-direction: column; gap: 12px; padding: 14px; }
.emoji { font-size: 1.6rem; }
.emojis .chip { padding: 6px 10px; min-height: 40px; font-size: 1.2rem; }
.small { font-size: .85rem; }
.modes .btn { text-align: center; text-decoration: none; padding-top: 13px; }
.disabled { opacity: .45; }
</style>
