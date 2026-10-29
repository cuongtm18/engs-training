<script setup lang="ts">
const store = useStore()
const { all } = useSentences()

const now = Date.now()
const rows = computed(() =>
  TOPICS.map((t) => {
    const list = all.value.filter((s) => s.t === t.id)
    const due = list.filter((s) => (store.state.value.cards[s.id]?.due ?? Infinity) <= now).length
    const done = list.filter((s) => (store.state.value.cards[s.id]?.box ?? 0) >= 3).length
    return { ...t, total: list.length, due, done }
  }),
)
const totalDue = computed(() => rows.value.reduce((n, r) => n + r.due, 0))
</script>

<template>
  <header class="head">
    <div>
      <h1>Phản xạ tiếng Anh</h1>
      <div class="muted">Học câu trước, rồi luyện phản xạ</div>
    </div>
    <NuxtLink to="/settings" class="gear" aria-label="Cài đặt">⚙️</NuxtLink>
  </header>

  <section class="stats">
    <div class="card stat"><b>🔥 {{ store.streak.value }}</b><span class="muted">ngày liên tiếp</span></div>
    <div class="card stat"><b>{{ store.today.value }}</b><span class="muted">câu hôm nay</span></div>
    <div class="card stat"><b>{{ store.learned.value }}</b><span class="muted">câu đã thuộc</span></div>
  </section>

  <NuxtLink v-if="totalDue" :to="{ path: '/practice', query: { t: 'all' } }" class="btn primary block review">
    🔁 Ôn lại {{ totalDue }} câu đến hạn
  </NuxtLink>

  <section class="topics">
    <div v-for="t in rows" :key="t.id" class="card topic">
      <div class="row">
        <span class="emoji">{{ t.emoji }}</span>
        <div class="grow">
          <b>{{ t.label }}</b>
          <div class="muted small">
            {{ t.total }} câu<template v-if="t.done"> · thuộc {{ t.done }}</template><template v-if="t.due"> · cần ôn {{ t.due }}</template>
          </div>
        </div>
      </div>
      <div class="row modes">
        <NuxtLink :to="{ path: '/learn', query: { t: t.id } }" class="btn grow">📖 Học</NuxtLink>
        <NuxtLink v-if="t.total" :to="{ path: '/practice', query: { t: t.id } }" class="btn primary grow">✍️ Luyện tập</NuxtLink>
        <span v-else class="btn grow disabled">✍️ Luyện tập</span>
      </div>
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
.small { font-size: .85rem; }
.modes .btn { text-align: center; text-decoration: none; padding-top: 13px; }
.disabled { opacity: .45; }
</style>
