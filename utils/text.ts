import type { CheckResult, Sentence } from './types'

const CONTRACTIONS: [RegExp, string][] = [
  [/\bwon't\b/g, 'will not'],
  [/\bcan't\b/g, 'can not'],
  [/\bcannot\b/g, 'can not'],
  [/\bshan't\b/g, 'shall not'],
  [/\bn't\b/g, ' not'],
  [/\bi'm\b/g, 'i am'],
  [/\b(you|we|they)'re\b/g, '$1 are'],
  [/\b(i|you|he|she|we|they|it|that|there)'ll\b/g, '$1 will'],
  [/\b(i|you|we|they|would|could|should)'ve\b/g, '$1 have'],
  [/\blet's\b/g, 'let us'],
]

/** Chuẩn hóa để so khớp: bỏ hoa/thường, dấu câu, mở rộng dạng viết tắt. */
export function normalize(s: string): string {
  let out = s.toLowerCase().replace(/[’‘`]/g, "'")
  for (const [re, rep] of CONTRACTIONS) out = out.replace(re, rep)
  return out
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function acceptedAnswers(s: Sentence): string[] {
  return [s.en, ...(s.alt ?? [])]
}

export function matchesAny(answer: string, s: Sentence): boolean {
  const a = normalize(answer)
  return a.length > 0 && acceptedAnswers(s).some((x) => normalize(x) === a)
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

/** Hash nhỏ để làm khóa cache. */
export function hashKey(...parts: string[]): string {
  const s = parts.map((p) => normalize(p)).join('||')
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

export type Verdict = 'perfect' | 'good' | 'wrong'

/** perfect: đúng cấu trúc và rất tự nhiên; good: đúng cấu trúc; wrong: sai cấu trúc/ý nghĩa. */
export function verdictOf(r: CheckResult): Verdict {
  if (!r.structureOk) return 'wrong'
  return r.naturalness >= 80 ? 'perfect' : 'good'
}

/** Tỉ lệ từ trùng với đáp án gần nhất, dùng để ước lượng khi offline. */
export function overlapRatio(answer: string, s: Sentence): number {
  const a = new Set(normalize(answer).split(' ').filter(Boolean))
  let best = 0
  for (const cand of acceptedAnswers(s)) {
    const words = normalize(cand).split(' ').filter(Boolean)
    if (!words.length) continue
    const hit = words.filter((w) => a.has(w)).length
    best = Math.max(best, hit / words.length)
  }
  return best
}
