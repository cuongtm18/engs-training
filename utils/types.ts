export interface Sentence {
  id: string
  t: string
  l: 1 | 2 | 3
  vi: string
  en: string
  alt?: string[]
  note?: string
}

export interface Topic {
  id: string
  label: string
  emoji: string
}

export type Verdict = 'perfect' | 'good' | 'wrong'

export interface CheckResult {
  verdict: Verdict
  /** Câu tự nhiên nhất mà app đề xuất */
  natural: string
  /** Giải thích ngắn bằng tiếng Việt */
  explanation: string
  /** Nguồn chấm: local = khớp đáp án có sẵn, gemini / workers-ai = AI, offline = không gọi được AI */
  engine: 'local' | 'gemini' | 'workers-ai' | 'offline'
}

export interface CardState {
  box: number
  due: number
  reps: number
  lapses: number
}

export interface Settings {
  accessCode: string
  seconds: number
  sessionSize: number
  dailyNew: number
}
