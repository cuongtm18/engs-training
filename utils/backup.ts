// Sao lưu / khôi phục toàn bộ dữ liệu của app. Là hàm thuần để dễ kiểm thử.
import type { CardState, CheckResult, Sentence, Settings, Topic } from './types'

export const BACKUP_APP = 'english-reflex'
export const BACKUP_VERSION = 1

/** Toàn bộ dữ liệu người dùng. Không gồm accessCode (là bí mật, không nên nằm trong file sao lưu). */
export interface BackupData {
  cards: Record<string, CardState>
  days: Record<string, number>
  custom: Sentence[]
  topics: Topic[]
  topicOverrides: Record<string, Partial<Pick<Topic, 'label' | 'emoji' | 'color' | 'icon'>>>
  hiddenTopics: string[]
  chatPos: Record<string, number>
  sentenceOrder: Record<string, string[]>
  settings: Omit<Settings, 'accessCode'>
  cache: Record<string, CheckResult>
}

export interface BackupSummary {
  exportedAt?: string
  ownSentences: number
  ownTopics: number
  learned: number
  reviewed: number
  activeDays: number
  answered: number
  customIcons: number
  reordered: number
}

export type ParsedBackup = { ok: true; data: BackupData; summary: BackupSummary; dropped: number } | { ok: false; error: string }

// ---------- build ----------

export function buildBackup(d: BackupData, now = new Date()): string {
  return JSON.stringify({ app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), data: d })
}

export function summarize(d: BackupData, exportedAt?: string): BackupSummary {
  return {
    exportedAt,
    ownSentences: d.custom.length,
    ownTopics: d.topics.length,
    learned: Object.values(d.cards).filter((c) => c.box >= 3).length,
    reviewed: Object.keys(d.cards).length,
    activeDays: Object.values(d.days).filter((n) => n > 0).length,
    answered: Object.values(d.days).reduce((n, v) => n + v, 0),
    customIcons: d.topics.filter((t) => t.icon).length + Object.values(d.topicOverrides).filter((t) => t.icon).length,
    reordered: Object.keys(d.sentenceOrder).length,
  }
}

// ---------- parse + sanitize ----------

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown, max: number): string | null => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : null)
const int = (v: unknown, min: number, max: number): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : null)
const SAFE_KEY = (k: string) => k !== '__proto__' && k !== 'constructor' && k !== 'prototype' && k.length <= 120
const ENGINES = new Set(['local', 'gemini', 'workers-ai', 'offline'])
const MAX_ICON = 400_000 // ký tự (data URL ảnh 128px nhỏ hơn nhiều)

export function parseBackup(text: string): ParsedBackup {
  let root: unknown
  try {
    root = JSON.parse(text)
  } catch {
    return { ok: false, error: 'This file is not valid JSON, so it cannot be a backup.' }
  }
  if (!isObj(root)) return { ok: false, error: 'This file is not an English Reflex backup.' }

  // new format { app, version, exportedAt, data } or the older flat format
  let src: Record<string, unknown> = root
  let exportedAt: string | undefined
  if ('data' in root || 'app' in root) {
    if (root.app !== BACKUP_APP) return { ok: false, error: 'This file is not an English Reflex backup.' }
    if (typeof root.version === 'number' && root.version > BACKUP_VERSION) return { ok: false, error: 'This backup was made by a newer version of the app. Update the app and try again.' }
    if (!isObj(root.data)) return { ok: false, error: 'The backup file is damaged (no data inside).' }
    src = root.data
    if (typeof root.exportedAt === 'string' && !Number.isNaN(Date.parse(root.exportedAt))) exportedAt = root.exportedAt
  }
  const known = ['cards', 'days', 'custom', 'topics', 'topicOverrides', 'hiddenTopics', 'chatPos', 'sentenceOrder', 'settings']
  if (!known.some((k) => k in src)) return { ok: false, error: 'This file is not an English Reflex backup.' }

  let dropped = 0
  const drop = () => void dropped++

  const cards: BackupData['cards'] = {}
  if (isObj(src.cards)) {
    for (const [id, c] of Object.entries(src.cards)) {
      if (!SAFE_KEY(id) || !isObj(c)) { drop(); continue }
      const box = int(c.box, 0, 5), due = typeof c.due === 'number' && Number.isFinite(c.due) ? c.due : null, reps = int(c.reps, 0, 1e6), lapses = int(c.lapses, 0, 1e6)
      if (box === null || due === null || reps === null || lapses === null) { drop(); continue }
      cards[id] = { box, due, reps, lapses }
    }
  }

  const days: BackupData['days'] = {}
  if (isObj(src.days)) {
    for (const [k, v] of Object.entries(src.days)) {
      const n = typeof v === 'number' && v >= 0 ? int(v, 0, 1e6) : null // số lần trả lời âm là dữ liệu hỏng: bỏ
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || n === null) { drop(); continue }
      days[k] = n
    }
  }

  const custom: Sentence[] = []
  if (Array.isArray(src.custom)) {
    const seen = new Set<string>()
    for (const s of src.custom) {
      if (!isObj(s)) { drop(); continue }
      const id = str(s.id, 80), t = str(s.t, 80), vi = str(s.vi, 500), en = str(s.en, 500)
      if (!id || !t || !vi || !en || seen.has(id)) { drop(); continue }
      seen.add(id)
      const alt = Array.isArray(s.alt) ? s.alt.map((a) => str(a, 500)).filter((a): a is string => !!a).slice(0, 8) : []
      const note = str(s.note, 600)
      custom.push({ id, t, vi, en, ...(alt.length ? { alt } : {}), ...(note ? { note } : {}), custom: true })
    }
  }

  const cleanIcon = (v: unknown) => (typeof v === 'string' && v.startsWith('data:image/') && v.length <= MAX_ICON ? v : undefined)

  const topics: Topic[] = []
  if (Array.isArray(src.topics)) {
    const seen = new Set<string>()
    for (const t of src.topics) {
      if (!isObj(t)) { drop(); continue }
      const id = str(t.id, 80), label = str(t.label, 60)
      if (!id || !label || seen.has(id)) { drop(); continue }
      seen.add(id)
      const icon = cleanIcon(t.icon), color = int(t.color, 0, 50)
      topics.push({ id, label, emoji: str(t.emoji, 16) ?? '📚', ...(icon ? { icon } : {}), ...(color !== null ? { color } : {}), custom: true })
    }
  }

  const topicOverrides: BackupData['topicOverrides'] = {}
  if (isObj(src.topicOverrides)) {
    for (const [id, o] of Object.entries(src.topicOverrides)) {
      if (!SAFE_KEY(id) || !isObj(o)) { drop(); continue }
      const label = str(o.label, 60), emoji = str(o.emoji, 16), color = int(o.color, 0, 50), icon = cleanIcon(o.icon)
      topicOverrides[id] = { ...(label ? { label } : {}), ...(emoji ? { emoji } : {}), ...(color !== null ? { color } : {}), ...(icon ? { icon } : {}) }
    }
  }

  const hiddenTopics = Array.isArray(src.hiddenTopics) ? [...new Set(src.hiddenTopics.map((v) => str(v, 80)).filter((v): v is string => !!v))] : []

  const chatPos: BackupData['chatPos'] = {}
  if (isObj(src.chatPos)) {
    for (const [id, v] of Object.entries(src.chatPos)) {
      const n = int(v, 0, 1e5)
      if (!SAFE_KEY(id) || n === null) { drop(); continue }
      if (n > 0) chatPos[id] = n
    }
  }

  const sentenceOrder: BackupData['sentenceOrder'] = {}
  if (isObj(src.sentenceOrder)) {
    for (const [id, v] of Object.entries(src.sentenceOrder)) {
      if (!SAFE_KEY(id) || !Array.isArray(v)) { drop(); continue }
      sentenceOrder[id] = v.map((x) => str(x, 80)).filter((x): x is string => !!x).slice(0, 5000)
    }
  }

  const st = isObj(src.settings) ? src.settings : {}
  const settings = { sessionSize: int(st.sessionSize, 3, 50) ?? 10, dailyNew: int(st.dailyNew, 0, 100) ?? 10 }

  const cache: BackupData['cache'] = {}
  if (isObj(src.cache)) {
    for (const [k, r] of Object.entries(src.cache).slice(0, 300)) {
      if (!SAFE_KEY(k) || !isObj(r) || typeof r.structureOk !== 'boolean' || typeof r.natural !== 'string' || typeof r.explanation !== 'string' || typeof r.engine !== 'string' || !ENGINES.has(r.engine)) continue
      const n = int(r.naturalness, 0, 100)
      if (n === null) continue
      cache[k] = { structureOk: r.structureOk, naturalness: n, ...(typeof r.corrected === 'string' ? { corrected: r.corrected.slice(0, 500) } : {}), natural: r.natural.slice(0, 500), explanation: r.explanation.slice(0, 800), engine: r.engine as CheckResult['engine'] }
    }
  }

  const data: BackupData = { cards, days, custom, topics, topicOverrides, hiddenTopics, chatPos, sentenceOrder, settings, cache }
  return { ok: true, data, summary: summarize(data, exportedAt), dropped }
}

/** Mô tả ngắn nội dung của một bản sao lưu, để hiện cho người dùng trước khi nhập. */
export function describeBackup(s: BackupSummary): string {
  const n = (k: number, one: string, many = one + 's') => `${k} ${k === 1 ? one : many}`
  const parts = [n(s.ownSentences, 'own sentence'), n(s.ownTopics, 'own topic'), `${s.learned} learned`, n(s.activeDays, 'active day'), n(s.answered, 'answer')]
  if (s.customIcons) parts.push(n(s.customIcons, 'custom icon'))
  const when = s.exportedAt ? `Saved ${new Date(s.exportedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}. ` : ''
  return `${when}Contains ${parts.join(', ')}.`
}
