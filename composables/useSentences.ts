import builtin from '~/data/sentences.json'
import type { Sentence } from '~/utils/types'

/** Câu có sẵn + câu người dùng tự thêm. */
export function useSentences() {
  const store = useStore()
  const all = computed<Sentence[]>(() => [...(builtin as Sentence[]), ...store.state.value.custom])
  const byTopic = (topic: string) => all.value.filter((s) => s.t === topic)
  return { all, byTopic }
}
