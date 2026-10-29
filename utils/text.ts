import type { Sentence } from './types'

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

export interface Token {
  text: string
  ok: boolean
}

const key = (w: string) => normalize(w)

/** So sánh theo từ (LCS). Trả về token của câu người dùng và của đáp án, kèm cờ ok. */
export function diffWords(answer: string, reference: string): { user: Token[]; ref: Token[] } {
  const a = answer.trim().split(/\s+/).filter(Boolean)
  const b = reference.trim().split(/\s+/).filter(Boolean)
  const ka = a.map(key)
  const kb = b.map(key)
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i]![j] = ka[i] === kb[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!)
    }
  }
  const user: Token[] = a.map((text) => ({ text, ok: false }))
  const ref: Token[] = b.map((text) => ({ text, ok: false }))
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (ka[i] === kb[j]) {
      user[i]!.ok = true
      ref[j]!.ok = true
      i++
      j++
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) i++
    else j++
  }
  return { user, ref }
}

/** Chọn đáp án gần nhất với câu người dùng để hiển thị diff. */
export function closestAnswer(answer: string, s: Sentence): string {
  let best = s.en
  let bestScore = -1
  for (const cand of acceptedAnswers(s)) {
    const { ref } = diffWords(answer, cand)
    const score = ref.filter((t) => t.ok).length / Math.max(ref.length, 1)
    if (score > bestScore) {
      bestScore = score
      best = cand
    }
  }
  return best
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
