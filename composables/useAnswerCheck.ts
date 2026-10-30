import type { CheckResult, Sentence } from '~/utils/types'

/** Chấm một câu trả lời: khớp câu mẫu → cache → AI → ước lượng offline. Dùng chung cho luyện tập thẻ và chat. */
export function useAnswerCheck() {
  const store = useStore()
  const api = useApi()

  function offline(s: Sentence, text: string, reason: string): CheckResult {
    const ratio = overlapRatio(text, s)
    const ok = ratio >= 0.7
    return {
      structureOk: ok,
      naturalness: ok ? Math.round(ratio * 100) : 0,
      natural: s.en,
      explanation: `${reason} App chỉ ước lượng bằng cách so với câu mẫu nên điểm chỉ mang tính tham khảo.`,
      engine: 'offline',
    }
  }

  /** Câu "tự nhiên" bắt buộc là tiếng Anh (cũng sửa luôn kết quả cũ trong cache). */
  function sanitize(res: CheckResult, s: Sentence): CheckResult {
    return hasVietnamese(res.natural) ? { ...res, natural: s.en } : res
  }

  async function check(s: Sentence, text: string): Promise<CheckResult> {
    if (matchesAny(text, s)) {
      return { structureOk: true, naturalness: 100, natural: text, explanation: 'Chuẩn rồi! Câu này đúng và nghe rất tự nhiên.', engine: 'local' }
    }
    const ck = hashKey('v3', s.id, text)
    const cached = store.state.value.cache[ck]
    if (cached) return sanitize(cached, s)
    try {
      const res = await api.check(s, text)
      store.state.value.cache[ck] = res
      return sanitize(res, s)
    } catch (e) {
      return offline(s, text, errorDetail(e))
    }
  }

  /** Kết quả khi người học bấm xem đáp án. */
  const peek = (s: Sentence): CheckResult => ({
    structureOk: false,
    naturalness: 0,
    natural: s.en,
    explanation: 'Bạn đã xem đáp án. Câu này sẽ quay lại sớm để ôn.',
    engine: 'local',
  })

  return { check, sanitize, peek }
}
