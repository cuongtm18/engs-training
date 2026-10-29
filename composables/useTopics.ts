import type { Topic } from '~/utils/types'

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)

/** Chủ đề có sẵn + tự tạo, đã áp dụng phần sửa tên/emoji/màu và ẩn các chủ đề đã xóa. */
export function useTopics() {
  const store = useStore()
  const resolved = computed<Topic[]>(() =>
    [...TOPICS, ...store.state.value.topics].map((t) => {
      const merged = { ...t, ...(store.state.value.topicOverrides[t.id] ?? {}) }
      return { ...merged, color: (merged.color ?? hash(t.id)) % TOPIC_COLORS.length }
    }),
  )
  const hiddenIds = computed(() => new Set(store.state.value.hiddenTopics))
  const all = computed(() => resolved.value.filter((t) => !hiddenIds.value.has(t.id)))
  const hidden = computed(() => resolved.value.filter((t) => hiddenIds.value.has(t.id)))
  const byId = (id: string) => resolved.value.find((t) => t.id === id)
  const colorOf = (t: Topic) => TOPIC_COLORS[t.color ?? 0]!
  return { all, hidden, byId, colorOf }
}
