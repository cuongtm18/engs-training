import builtin from '~/data/sentences.json'
import type { Sentence } from '~/utils/types'

/** Câu có sẵn + câu người dùng tự thêm. */
export function useSentences() {
  const store = useStore()
  const all = computed<Sentence[]>(() => [...(builtin as Sentence[]), ...store.state.value.custom])

  /** Câu của một chủ đề theo thứ tự người dùng đã sắp. Câu chưa có trong thứ tự (mới thêm) nằm cuối, giữ nguyên thứ tự thêm. */
  const byTopic = (topic: string) => {
    const list = all.value.filter((s) => s.t === topic)
    const order = store.state.value.sentenceOrder[topic]
    if (!order?.length) return list
    const rank = new Map(order.map((id, i) => [id, i]))
    return list
      .map((s, i) => ({ s, k: rank.get(s.id) ?? order.length + i }))
      .sort((a, b) => a.k - b.k)
      .map((x) => x.s)
  }
  return { all, byTopic }
}
