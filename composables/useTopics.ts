import type { Topic } from '~/utils/types'

/** Chủ đề có sẵn + chủ đề người dùng tự tạo. */
export function useTopics() {
  const store = useStore()
  const all = computed<Topic[]>(() => [...TOPICS, ...store.state.value.topics])
  const byId = (id: string) => all.value.find((t) => t.id === id)
  return { all, byId }
}
