import type { CardState, CheckResult, Sentence, Settings, Topic } from '~/utils/types'

const KEY = 'engs.v1'
const INTERVAL_DAYS = [0, 1, 3, 7, 16, 35]
const DAY = 86_400_000

interface Persisted {
  cards: Record<string, CardState>
  days: Record<string, number>
  settings: Settings
  cache: Record<string, CheckResult>
  custom: Sentence[]
  topics: Topic[]
  topicOverrides: Record<string, Partial<Pick<Topic, 'label' | 'emoji' | 'color'>>>
  hiddenTopics: string[]
}

const defaults = (): Persisted => ({
  cards: {},
  days: {},
  cache: {},
  custom: [],
  topics: [],
  topicOverrides: {},
  hiddenTopics: [],
  settings: { accessCode: '', sessionSize: 10, dailyNew: 10 },
})

export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function load(): Persisted {
  const base = defaults()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return base
    const p = JSON.parse(raw) as Partial<Persisted>
    // bỏ kết quả cache theo định dạng chấm cũ (không có structureOk)
    const cache = Object.fromEntries(Object.entries(p.cache ?? {}).filter(([, v]) => typeof (v as CheckResult)?.structureOk === 'boolean'))
    return {
      cards: p.cards ?? {},
      days: p.days ?? {},
      cache,
      custom: p.custom ?? [],
      topics: p.topics ?? [],
      topicOverrides: p.topicOverrides ?? {},
      hiddenTopics: p.hiddenTopics ?? [],
      settings: { ...base.settings, ...(p.settings ?? {}) },
    }
  } catch {
    return base
  }
}

export function useStore() {
  const state = useState<Persisted>('engs-store', () => (import.meta.client ? load() : defaults()))

  function save() {
    try {
      // giữ cache ở mức vừa phải
      const keys = Object.keys(state.value.cache)
      if (keys.length > 300) for (const k of keys.slice(0, keys.length - 300)) delete state.value.cache[k]
      localStorage.setItem(KEY, JSON.stringify(state.value))
    } catch {
      /* bộ nhớ đầy hoặc bị chặn: bỏ qua */
    }
  }

  /** Cập nhật thẻ sau khi trả lời. quality: 2 = đúng và rất tự nhiên, 1 = đúng cấu trúc, 0 = sai. */
  function grade(id: string, quality: 0 | 1 | 2) {
    const c = state.value.cards[id] ?? { box: 0, due: 0, reps: 0, lapses: 0 }
    c.reps++
    if (quality === 0) {
      c.lapses++
      c.box = 0
      c.due = Date.now() + 10 * 60_000
    } else {
      c.box = Math.min(c.box + (quality === 2 ? 1 : 0) + (c.box === 0 ? 1 : 0), INTERVAL_DAYS.length - 1)
      c.due = Date.now() + INTERVAL_DAYS[c.box]! * DAY
    }
    state.value.cards[id] = c
    const k = dayKey()
    state.value.days[k] = (state.value.days[k] ?? 0) + 1
    save()
  }

  const today = computed(() => state.value.days[dayKey()] ?? 0)

  const streak = computed(() => {
    let n = 0
    const d = new Date()
    if (!state.value.days[dayKey(d)]) d.setDate(d.getDate() - 1)
    while (state.value.days[dayKey(d)]) {
      n++
      d.setDate(d.getDate() - 1)
    }
    return n
  })

  const learned = computed(() => Object.values(state.value.cards).filter((c) => c.box >= 3).length)

  function addSentences(items: Omit<Sentence, 'id' | 'custom'>[]) {
    const stamp = Date.now().toString(36)
    const added = items.map((s, i): Sentence => ({ ...s, id: `u-${stamp}${i.toString(36)}${Math.random().toString(36).slice(2, 5)}`, custom: true }))
    state.value.custom.unshift(...added)
    save()
    return added
  }

  function addTopic(label: string, emoji: string, color = 0): Topic {
    const topic: Topic = { id: `c-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`, label: label.trim().slice(0, 40), emoji: emoji.trim() || '📚', color, custom: true }
    state.value.topics.push(topic)
    save()
    return topic
  }

  /** Sửa tên, emoji, màu. Chủ đề có sẵn được lưu dưới dạng ghi đè nên có thể sửa như chủ đề tự tạo. */
  function updateTopic(id: string, patch: { label?: string; emoji?: string; color?: number }) {
    const clean = {
      ...(patch.label?.trim() ? { label: patch.label.trim().slice(0, 40) } : {}),
      ...(patch.emoji?.trim() ? { emoji: patch.emoji.trim() } : {}),
      ...(patch.color !== undefined ? { color: patch.color } : {}),
    }
    const own = state.value.topics.find((t) => t.id === id)
    if (own) Object.assign(own, clean)
    else state.value.topicOverrides[id] = { ...state.value.topicOverrides[id], ...clean }
    save()
  }

  /** Xóa chủ đề tự tạo cùng toàn bộ câu và tiến độ của nó. */
  function removeTopic(id: string) {
    for (const s of state.value.custom) if (s.t === id) delete state.value.cards[s.id]
    state.value.custom = state.value.custom.filter((s) => s.t !== id)
    state.value.topics = state.value.topics.filter((t) => t.id !== id)
    save()
  }

  /** Chủ đề có sẵn không xóa hẳn được (dữ liệu nằm trong app) nên chỉ ẩn, có thể khôi phục. */
  function hideTopic(id: string) {
    if (!state.value.hiddenTopics.includes(id)) state.value.hiddenTopics.push(id)
    save()
  }

  function unhideTopic(id: string) {
    state.value.hiddenTopics = state.value.hiddenTopics.filter((x) => x !== id)
    save()
  }

  function removeSentence(id: string) {
    state.value.custom = state.value.custom.filter((s) => s.id !== id)
    delete state.value.cards[id]
    save()
  }

  function setSettings(patch: Partial<Settings>) {
    Object.assign(state.value.settings, patch)
    save()
  }

  function reset() {
    state.value = defaults()
    save()
  }

  function exportJson() {
    return JSON.stringify({ cards: state.value.cards, days: state.value.days, custom: state.value.custom, topics: state.value.topics, topicOverrides: state.value.topicOverrides, hiddenTopics: state.value.hiddenTopics, settings: state.value.settings })
  }

  function importJson(raw: string) {
    const p = JSON.parse(raw) as Partial<Persisted>
    if (typeof p !== 'object' || !p) throw new Error('invalid')
    state.value = { ...defaults(), cards: p.cards ?? {}, days: p.days ?? {}, custom: p.custom ?? [], topics: p.topics ?? [], topicOverrides: p.topicOverrides ?? {}, hiddenTopics: p.hiddenTopics ?? [], settings: { ...defaults().settings, ...(p.settings ?? {}) } }
    save()
  }

  return { state, grade, today, streak, learned, addSentences, removeSentence, addTopic, updateTopic, removeTopic, hideTopic, unhideTopic, setSettings, reset, save, exportJson, importJson }
}
