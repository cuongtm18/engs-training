import { buildBackup, parseBackup, type BackupData } from '~/utils/backup'
import type { CardState, CheckResult, Sentence, Settings, Topic } from '~/utils/types'

const KEY = 'engs.v1'
const INTERVAL_DAYS = [0, 1, 3, 7, 16, 35]
const DAY = 86_400_000

interface Persisted {
  cards: Record<string, CardState>
  days: Record<string, number>
  settings: Settings
  cache: Record<string, CheckResult>
  custom: Sentence[]
  topics: Topic[]
  topicOverrides: Record<string, Partial<Pick<Topic, 'label' | 'emoji' | 'color' | 'icon'>>>
  hiddenTopics: string[]
  /** Chat practice: index of the next sentence to ask, per topic */
  chatPos: Record<string, number>
  /** Custom sentence order per topic: sentence ids from first to last */
  sentenceOrder: Record<string, string[]>
}

const defaults = (): Persisted => ({
  cards: {},
  days: {},
  cache: {},
  custom: [],
  topics: [],
  topicOverrides: {},
  hiddenTopics: [],
  chatPos: {},
  sentenceOrder: {},
  settings: { accessCode: '', sessionSize: 10, dailyNew: 10 },
})

export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function load(): Persisted {
  const base = defaults()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return base
    const p = JSON.parse(raw) as Partial<Persisted>
    // bỏ kết quả cache theo định dạng chấm cũ (không có structureOk)
    const cache = Object.fromEntries(Object.entries(p.cache ?? {}).filter(([, v]) => typeof (v as CheckResult)?.structureOk === 'boolean'))
    return {
      cards: p.cards ?? {},
      days: p.days ?? {},
      cache,
      custom: p.custom ?? [],
      topics: p.topics ?? [],
      topicOverrides: p.topicOverrides ?? {},
      hiddenTopics: p.hiddenTopics ?? [],
      chatPos: p.chatPos ?? {},
      sentenceOrder: p.sentenceOrder ?? {},
      settings: { ...base.settings, ...(p.settings ?? {}) },
    }
  } catch {
    return base
  }
}

export function useStore() {
  const state = useState<Persisted>('engs-store', () => (import.meta.client ? load() : defaults()))

  function save() {
    try {
      // giữ cache ở mức vừa phải
      const keys = Object.keys(state.value.cache)
      if (keys.length > 300) for (const k of keys.slice(0, keys.length - 300)) delete state.value.cache[k]
      localStorage.setItem(KEY, JSON.stringify(state.value))
    } catch {
      /* bộ nhớ đầy hoặc bị chặn: bỏ qua */
    }
  }

  /** Cập nhật thẻ sau khi trả lời. quality: 2 = đúng và rất tự nhiên, 1 = đúng cấu trúc, 0 = sai. */
  function grade(id: string, quality: 0 | 1 | 2) {
    const c = state.value.cards[id] ?? { box: 0, due: 0, reps: 0, lapses: 0 }
    c.reps++
    if (quality === 0) {
      c.lapses++
      c.box = 0
      c.due = Date.now() + 10 * 60_000
    } else {
      c.box = Math.min(c.box + (quality === 2 ? 1 : 0) + (c.box === 0 ? 1 : 0), INTERVAL_DAYS.length - 1)
      c.due = Date.now() + INTERVAL_DAYS[c.box]! * DAY
    }
    state.value.cards[id] = c
    const k = dayKey()
    state.value.days[k] = (state.value.days[k] ?? 0) + 1
    save()
  }

  const today = computed(() => state.value.days[dayKey()] ?? 0)

  const streak = computed(() => {
    let n = 0
    const d = new Date()
    if (!state.value.days[dayKey(d)]) d.setDate(d.getDate() - 1)
    while (state.value.days[dayKey(d)]) {
      n++
      d.setDate(d.getDate() - 1)
    }
    return n
  })

  const learned = computed(() => Object.values(state.value.cards).filter((c) => c.box >= 3).length)

  function addSentences(items: Omit<Sentence, 'id' | 'custom'>[]) {
    const stamp = Date.now().toString(36)
    const added = items.map((s, i): Sentence => ({ ...s, id: `u-${stamp}${i.toString(36)}${Math.random().toString(36).slice(2, 5)}`, custom: true }))
    // Appended, so the list keeps the order you pasted it in (chat practice follows that order)
    state.value.custom.push(...added)
    save()
    return added
  }

  function addTopic(label: string, emoji: string, color = 0, icon = ''): Topic {
    const topic: Topic = { id: `c-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`, label: label.trim().slice(0, 40), emoji: emoji.trim() || '📚', color, custom: true, ...(icon ? { icon } : {}) }
    state.value.topics.push(topic)
    save()
    return topic
  }

  /** Sửa tên, emoji, màu. Chủ đề có sẵn được lưu dưới dạng ghi đè nên có thể sửa như chủ đề tự tạo. */
  function updateTopic(id: string, patch: { label?: string; emoji?: string; color?: number; icon?: string }): () => void {
    const clean = {
      ...(patch.label?.trim() ? { label: patch.label.trim().slice(0, 40) } : {}),
      ...(patch.emoji?.trim() ? { emoji: patch.emoji.trim() } : {}),
      ...(patch.color !== undefined ? { color: patch.color } : {}),
      // chuỗi rỗng = gỡ ảnh tự tải lên
      ...(patch.icon !== undefined ? { icon: patch.icon } : {}),
    }
    const own = state.value.topics.find((t) => t.id === id)
    const prevOwn = own ? { label: own.label, emoji: own.emoji, color: own.color, icon: own.icon } : undefined
    const prevOverride = state.value.topicOverrides[id] ? { ...state.value.topicOverrides[id] } : undefined
    if (own) Object.assign(own, clean)
    else state.value.topicOverrides[id] = { ...state.value.topicOverrides[id], ...clean }
    save()
    return () => {
      const cur = state.value.topics.find((t) => t.id === id)
      if (cur && prevOwn) Object.assign(cur, prevOwn)
      else if (prevOverride) state.value.topicOverrides[id] = prevOverride
      else delete state.value.topicOverrides[id]
      save()
    }
  }

  /** Xóa chủ đề tự tạo cùng toàn bộ câu và tiến độ của nó. */
  function removeTopic(id: string): () => void {
    const index = state.value.topics.findIndex((t) => t.id === id)
    const topic = state.value.topics[index]
    const sentences = state.value.custom.filter((s) => s.t === id)
    const cards = Object.fromEntries(sentences.filter((s) => state.value.cards[s.id]).map((s) => [s.id, state.value.cards[s.id]!]))
    for (const s of sentences) delete state.value.cards[s.id]
    state.value.custom = state.value.custom.filter((s) => s.t !== id)
    state.value.topics = state.value.topics.filter((t) => t.id !== id)
    save()
    return () => {
      if (!topic || state.value.topics.some((t) => t.id === id)) return
      state.value.topics.splice(Math.min(index, state.value.topics.length), 0, topic)
      state.value.custom.push(...sentences)
      Object.assign(state.value.cards, cards)
      save()
    }
  }

  /** Chủ đề có sẵn không xóa hẳn được (dữ liệu nằm trong app) nên chỉ ẩn, có thể khôi phục. */
  function hideTopic(id: string): () => void {
    if (!state.value.hiddenTopics.includes(id)) state.value.hiddenTopics.push(id)
    save()
    return () => unhideTopic(id)
  }

  function unhideTopic(id: string): () => void {
    state.value.hiddenTopics = state.value.hiddenTopics.filter((x) => x !== id)
    save()
    return () => hideTopic(id)
  }

  function removeSentence(id: string): () => void {
    const index = state.value.custom.findIndex((s) => s.id === id)
    if (index < 0) return () => {}
    const sentence = state.value.custom[index]!
    const card = state.value.cards[id]
    state.value.custom.splice(index, 1)
    delete state.value.cards[id]
    save()
    return () => {
      if (state.value.custom.some((s) => s.id === id)) return
      state.value.custom.splice(Math.min(index, state.value.custom.length), 0, sentence)
      if (card) state.value.cards[id] = card
      save()
    }
  }

  function removeSentences(ids: string[]) {
    const set = new Set(ids)
    state.value.custom = state.value.custom.filter((s) => !set.has(s.id))
    for (const id of ids) delete state.value.cards[id]
    save()
  }

  /** Save a custom order for a topic (null = back to the default order). Returns an undo function. */
  function setOrder(topicId: string, ids: string[] | null): () => void {
    const prev = state.value.sentenceOrder[topicId]
    const prevPos = state.value.chatPos[topicId]
    if (ids?.length) state.value.sentenceOrder[topicId] = [...ids]
    else delete state.value.sentenceOrder[topicId]
    delete state.value.chatPos[topicId] // saved chat position no longer points at the same sentence
    save()
    return () => {
      if (prev) state.value.sentenceOrder[topicId] = prev
      else delete state.value.sentenceOrder[topicId]
      if (prevPos) state.value.chatPos[topicId] = prevPos
      save()
    }
  }

  function setChatPos(topicId: string, pos: number) {
    if (pos > 0) state.value.chatPos[topicId] = pos
    else delete state.value.chatPos[topicId]
    save()
  }

  function setSettings(patch: Partial<Settings>) {
    Object.assign(state.value.settings, patch)
    save()
  }

  const snapshot = () => JSON.stringify(state.value)
  const restoreSnapshot = (raw: string) => {
    state.value = JSON.parse(raw)
    save()
  }

  function reset() {
    const snap = snapshot()
    state.value = defaults()
    save()
    return () => restoreSnapshot(snap)
  }

  /** Toàn bộ dữ liệu cần sao lưu (không gồm accessCode, là bí mật của riêng thiết bị). */
  function backupData(): BackupData {
    const { accessCode: _secret, ...settings } = state.value.settings
    return {
      cards: state.value.cards,
      days: state.value.days,
      custom: state.value.custom,
      topics: state.value.topics,
      topicOverrides: state.value.topicOverrides,
      hiddenTopics: state.value.hiddenTopics,
      chatPos: state.value.chatPos,
      sentenceOrder: state.value.sentenceOrder,
      settings,
      cache: state.value.cache,
    }
  }

  const exportJson = () => buildBackup(backupData())

  /** Thay toàn bộ dữ liệu bằng bản sao lưu đã được kiểm tra. Giữ accessCode của thiết bị này. Trả về hàm hoàn tác. */
  function applyBackup(data: BackupData): () => void {
    const snap = snapshot()
    state.value = { ...defaults(), ...data, settings: { ...defaults().settings, ...data.settings, accessCode: state.value.settings.accessCode } }
    save()
    return () => restoreSnapshot(snap)
  }

  /** Nhập từ chuỗi JSON (ném lỗi nếu không phải bản sao lưu hợp lệ). */
  function importJson(raw: string) {
    const parsed = parseBackup(raw)
    if (!parsed.ok) throw new Error(parsed.error)
    return applyBackup(parsed.data)
  }

  return { state, grade, today, streak, learned, addSentences, removeSentence, removeSentences, addTopic, updateTopic, removeTopic, hideTopic, unhideTopic, setOrder, setChatPos, setSettings, reset, save, backupData, applyBackup, exportJson, importJson }
}
