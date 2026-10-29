// Hoàn tác khi xóa chữ trong ô nhập (kể cả bằng bàn phím của hệ điều hành).
// Gom cả chuỗi phím xóa liên tiếp thành một lần (debounce), chỉ báo khi xóa đáng kể.

const MIN_CHARS = 6 // xóa ít hơn thế này thì để người dùng tự gõ lại
const DEBOUNCE_MS = 700

type TextEl = HTMLInputElement | HTMLTextAreaElement

const TEXT_TYPES = new Set(['text', 'search', 'url', 'email', 'tel', ''])

function isTextEl(t: EventTarget | null): t is TextEl {
  if (t instanceof HTMLTextAreaElement) return !t.readOnly && !t.disabled && !('noUndo' in t.dataset)
  if (t instanceof HTMLInputElement) return TEXT_TYPES.has(t.type) && !t.readOnly && !t.disabled && !('noUndo' in t.dataset)
  return false
}

export function installTextUndo(): () => void {
  const undo = useUndo()
  let burst: { el: TextEl; kind: 'delete' | 'replace'; before: string; caret: number; selected: number; timer?: ReturnType<typeof setTimeout> } | null = null

  function flush() {
    if (!burst) return
    clearTimeout(burst.timer)
    const { el, kind, before, caret, selected } = burst
    burst = null
    if (!el.isConnected || el.value === before) return
    const removed = before.length - el.value.length
    const wiped = before.trim().length >= 3 && el.value.trim() === ''
    if (removed < MIN_CHARS && selected < MIN_CHARS && !wiped) return
    undo.push({
      message: wiped ? 'Text cleared' : kind === 'replace' ? 'Text replaced' : 'Text deleted',
      undo: () => {
        if (!el.isConnected) return
        el.value = before
        el.dispatchEvent(new Event('input', { bubbles: true })) // giữ v-model đồng bộ
        el.focus()
        try {
          el.setSelectionRange(caret, caret)
        } catch {
          /* một số kiểu input không hỗ trợ */
        }
      },
    })
  }

  function onBeforeInput(e: Event) {
    const ev = e as InputEvent
    const el = ev.target
    if (!isTextEl(el)) return
    const isDelete = ev.inputType?.startsWith('delete')
    const selected = Math.abs((el.selectionEnd ?? 0) - (el.selectionStart ?? 0))

    const kind = isDelete ? 'delete' : 'replace'
    // Chốt lượt trước khi bắt đầu lượt khác: đổi ô nhập, chuyển giữa xóa và gõ/dán đè, hoặc gõ tiếp bình thường.
    if (burst && (burst.el !== el || burst.kind !== kind)) flush()
    if (!isDelete && selected < MIN_CHARS) return // gõ bình thường, không đè vùng chọn lớn
    if (!burst) burst = { el, kind, before: el.value, caret: el.selectionStart ?? el.value.length, selected }
    else burst.selected = Math.max(burst.selected, selected)
    clearTimeout(burst.timer)
    burst.timer = setTimeout(flush, DEBOUNCE_MS)
  }

  function onKeyDown(e: KeyboardEvent) {
    // Ctrl/Cmd+Z ngoài ô nhập = hoàn tác thao tác gần nhất. Trong ô nhập thì để hệ điều hành tự xử lý.
    if (e.key.toLowerCase() !== 'z' || !(e.metaKey || e.ctrlKey) || e.shiftKey) return
    if (isTextEl(e.target)) return
    if (undo.runLatest()) e.preventDefault()
  }

  document.addEventListener('beforeinput', onBeforeInput, true)
  document.addEventListener('keydown', onKeyDown)
  return () => {
    document.removeEventListener('beforeinput', onBeforeInput, true)
    document.removeEventListener('keydown', onKeyDown)
    flush()
  }
}
