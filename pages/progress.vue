<script setup lang="ts">
const store = useStore()
const { all } = useSentences()
const topics = useTopics()

const week = computed(() => {
  const out: { label: string; n: number; today: boolean }[] = []
  const d = new Date()
  d.setDate(d.getDate() - 6)
  for (let i = 0; i < 7; i++) {
    out.push({ label: d.toLocaleDateString('en-US', { weekday: 'short' }), n: store.state.value.days[dayKey(d)] ?? 0, today: i === 6 })
    d.setDate(d.getDate() + 1)
  }
  return out
})
const max = computed(() => Math.max(1, ...week.value.map((w) => w.n)))
const weekTotal = computed(() => week.value.reduce((n, w) => n + w.n, 0))

const total = computed(() => all.value.length)
const learned = computed(() => store.learned.value)

const perTopic = computed(() =>
  topics.all.value.map((t) => {
    const list = all.value.filter((s) => s.t === t.id)
    const done = list.filter((s) => (store.state.value.cards[s.id]?.box ?? 0) >= 3).length
    return { ...t, total: list.length, done }
  }),
)
</script>

<template>
  <header class="head"><h1 class="large-title">Progress</h1></header>

  <section class="card hero">
    <div class="ringbox">
      <ProgressRing :value="total ? learned / total : 0" :size="96" :stroke="10" />
      <b class="pct">{{ total ? Math.round((learned / total) * 100) : 0 }}%</b>
    </div>
    <div class="grow">
      <b class="big">{{ learned }} <span class="muted">of {{ total }}</span></b>
      <div class="muted">sentences learned</div>
    </div>
  </section>

  <section class="two">
    <div class="card stat"><b>🔥 {{ store.streak.value }}</b><span class="muted small">day streak</span></div>
    <div class="card stat"><b>{{ store.today.value }}</b><span class="muted small">answered today</span></div>
  </section>

  <section class="card section">
    <div class="row"><h2 class="grow">Last 7 days</h2><span class="muted small">{{ weekTotal }} answered</span></div>
    <div class="chart">
      <div v-for="(w, i) in week" :key="i" class="col">
        <div class="bar"><i :class="{ today: w.today }" :style="{ height: (w.n / max) * 100 + '%' }" /></div>
        <span class="muted small" :class="{ now: w.today }">{{ w.label }}</span>
      </div>
    </div>
  </section>

  <section class="card section">
    <h2>By topic</h2>
    <div class="topics">
      <NuxtLink v-for="t in perTopic" :key="t.id" :to="{ path: '/learn', query: { t: t.id } }" class="trow">
        <TopicIcon class="em" :emoji="t.emoji" :icon="t.icon" :size="26" />
        <span class="grow">
          <span class="line"><b>{{ t.label }}</b><span class="muted small">{{ t.done }}/{{ t.total }}</span></span>
          <span class="meter"><i :style="{ width: (t.total ? (t.done / t.total) * 100 : 0) + '%', background: TOPIC_COLORS[t.color ?? 0] }" /></span>
        </span>
      </NuxtLink>
    </div>
  </section>
</template>

<style scoped>
.head { margin: 8px 0 14px; }
.hero { display: flex; align-items: center; gap: 18px; margin-bottom: 12px; }
.ringbox { position: relative; display: grid; place-items: center; }
.ringbox svg { color: var(--ink); }
.pct { position: absolute; font-size: 1.2rem; }
.big { font-size: 1.7rem; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
.stat { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 16px 8px; }
.stat b { font-size: 1.6rem; }
.section + .section { margin-top: 12px; }
.two .card + .card { margin-top: 0; }
.chart { display: flex; align-items: flex-end; gap: 10px; height: 130px; margin-top: 10px; }
.col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; height: 100%; }
.bar { flex: 1; width: 100%; display: flex; align-items: flex-end; background: color-mix(in srgb, var(--accent) 8%, transparent); border-radius: 10px; overflow: hidden; }
.bar i { display: block; width: 100%; min-height: 4px; border-radius: 10px; background: color-mix(in srgb, var(--accent) 55%, var(--card)); transition: height .5s; }
.bar i.today { background: var(--accent); }
.now { color: var(--accent); font-weight: 700; }
.topics { display: flex; flex-direction: column; gap: 14px; margin-top: 6px; }
.trow { display: flex; align-items: center; gap: 12px; text-decoration: none; color: var(--ink); }
.em { font-size: 1.4rem; }
.line { display: flex; justify-content: space-between; margin-bottom: 4px; }
.meter { display: block; height: 7px; background: var(--soft); border-radius: 99px; overflow: hidden; }
.meter i { display: block; height: 100%; border-radius: 99px; transition: width .5s; }
</style>
