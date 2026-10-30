import type { CheckResult, Sentence } from './types'

const CONTRACTIONS: [RegExp, string][] = [
  [/\bwon't\b/g, 'will not'],
  [/\bcan't\b/g, 'can not'],
  [/\bcannot\b/g, 'can not'],
  [/\bshan't\b/g, 'shall not'],
  [/n't\b/g, ' not'], // don't, isn't, doesn't, … (can't/won't are handled just above)
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

/** True if the text contains letters that only Vietnamese uses (ă â đ ê ô ơ ư and tone-marked vowels). */
export function hasVietnamese(s: string): boolean {
  return /[ăâđêôơưĂÂĐÊÔƠƯ\u1EA0-\u1EF9]/.test(s)
}

export type Verdict = 'perfect' | 'good' | 'wrong'

/** perfect: đúng cấu trúc và rất tự nhiên; good: đúng cấu trúc; wrong: sai cấu trúc/ý nghĩa. */
export function verdictOf(r: CheckResult): Verdict {
  if (!r.structureOk) return 'wrong'
  return r.naturalness >= 85 ? 'perfect' : 'good'
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

export interface Token {
  text: string
  changed: boolean
}

/** Tách câu đã sửa thành các từ và đánh dấu từ nào là mới/đã đổi so với câu người học gõ. */
export function highlightChanges(user: string, corrected: string): Token[] {
  const have = new Map<string, number>()
  for (const w of normalize(user).split(' ').filter(Boolean)) have.set(w, (have.get(w) ?? 0) + 1)
  return corrected
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((text) => {
      // "I'm" normalizes to "i am", "I'll" to "i will": unchanged when every part was already in your sentence
      const parts = normalize(text).split(' ').filter(Boolean)
      if (!parts.length) return { text, changed: false }
      const need = new Map<string, number>()
      for (const w of parts) need.set(w, (need.get(w) ?? 0) + 1)
      const ok = [...need].every(([w, c]) => (have.get(w) ?? 0) >= c)
      if (!ok) return { text, changed: true }
      for (const [w, c] of need) have.set(w, (have.get(w) ?? 0) - c)
      return { text, changed: false }
    })
}

/** Hai câu giống nhau sau khi chuẩn hóa (bỏ hoa/thường, dấu câu, dạng viết tắt)? */
export const sameSentence = (a: string, b: string) => normalize(a) === normalize(b)
