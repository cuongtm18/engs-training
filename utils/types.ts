export interface Sentence {
  id: string
  t: string
  vi: string
  en: string
  alt?: string[]
  note?: string
  /** Câu do người dùng tự thêm */
  custom?: boolean
}

export interface Topic {
  id: string
  label: string
  emoji: string
}

/** Kết quả chấm 2 bước: đúng cấu trúc/ý nghĩa trước, rồi mới tới độ tự nhiên. */
export interface CheckResult {
  /** Bước 1: câu đúng ngữ pháp và đủ ý so với câu tiếng Việt */
  structureOk: boolean
  /** Bước 2: độ tự nhiên 0-100 (chỉ có nghĩa khi structureOk) */
  naturalness: number
  /** Câu tự nhiên nhất mà app đề xuất */
  natural: string
  /** Giải thích ngắn bằng tiếng Việt */
  explanation: string
  /** local = khớp câu mẫu, gemini / workers-ai = AI, offline = không gọi được AI */
  engine: 'local' | 'gemini' | 'workers-ai' | 'offline'
}

export interface TranslatedLine {
  vi: string
  en: string
}

export interface TranslateResult {
  /** Cùng thứ tự và số lượng với các dòng gửi lên; dòng dịch lỗi có vi/en rỗng */
  items: TranslatedLine[]
  engine: 'gemini' | 'workers-ai'
}

export interface CardState {
  box: number
  due: number
  reps: number
  lapses: number
}

export interface Settings {
  accessCode: string
  sessionSize: number
  dailyNew: number
}
