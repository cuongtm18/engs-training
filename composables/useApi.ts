import type { CheckResult, Sentence, TranslatedLine, TranslateResult } from '~/utils/types'

/** Lấy lý do lỗi dễ hiểu từ lỗi của $fetch. */
export function errorDetail(e: any): string {
  const detail = e?.data?.data?.detail
  if (detail) return detail
  const code = e?.statusCode ?? e?.response?.status
  if (code) return `The server returned error ${code}.`
  return 'Could not reach the server (you may be offline).'
}

export function useApi() {
  const store = useStore()
  const headers = () => (store.state.value.settings.accessCode ? { 'x-access-code': store.state.value.settings.accessCode } : undefined)

  return {
    check: (s: Sentence, answer: string) =>
      $fetch<CheckResult>('/api/check', {
        method: 'POST',
        headers: headers(),
        body: { vi: s.vi, answer, reference: s.en, alternatives: s.alt ?? [] },
        timeout: 25_000,
      }),
    /** Dịch tối đa 20 dòng một lần (mỗi dòng có thể là tiếng Anh hoặc tiếng Việt). */
    translate: (lines: string[]) =>
      $fetch<TranslateResult>('/api/translate', { method: 'POST', headers: headers(), body: { lines }, timeout: 60_000 }),
    /** AI viết một kịch bản câu cho chủ đề. */
    generate: (topic: string, situation: string, count: number, avoid: string[]) =>
      $fetch<{ items: TranslatedLine[]; engine: string }>('/api/generate', {
        method: 'POST',
        headers: headers(),
        body: { topic, situation, count, avoid },
        timeout: 60_000,
      }),
  }
}
