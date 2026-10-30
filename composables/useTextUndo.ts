// Hoàn tác khi xóa chữ trong ô nhập (kể cả bằng bàn phím của hệ điều hành).
// Chỉ báo khi người dùng thật sự MẤT một lượng nội dung đáng kể, không báo khi chỉ sửa lỗi gõ.

const DEBOUNCE_MS = 700 // gom cả chuỗi phím xóa liên tiếp thành một lần

type TextEl = HTMLInputElement | HTMLTextAreaElement

const TEXT_TYPES = new Set(['text', 'search', 'url', 'email', 'tel', ''])

function isTextEl(t: EventTarget | null): t is TextEl {
  if (t instanceof HTMLTextAreaElement) return !t.readOnly && !t.disabled && !('noUndo' in t.dataset)
  if (t instanceof HTMLInputElement) return TEXT_TYPES.has(t.type) && !t.readOnly && !t.disabled && !('noUndo' in t.dataset)
  return false
}

/** Phần chữ bị mất giữa hai giá trị (bỏ phần đầu và phần cuối giống nhau). */
export function lostText(before: string, after: string): string {
  let a = 0
  while (a < before.length && a < after.length && before[a] === after[a]) a++
  let b = 0
  while (b < before.length - a && b < after.length - a && before[before.length - 1 - b] === after[after.length - 1 - b]) b++
  return before.slice(a, before.length - b)
}

/**
 * Có đáng báo hoàn tác không?
 * - xóa trống cả ô đang có nội dung (từ 8 ký tự) → có
 * - mất từ 25 ký tự trở lên (cỡ một mệnh đề) → có
 * - mất từ 3 từ và từ 12 ký tự trở lên → có
 * - mất từ 2 từ, từ 12 ký tự và chiếm từ 60% nội dung → có
 * - còn lại (xóa một từ dù dài, sửa lỗi gõ, bớt vài chữ) → không
 */
export function isSignificantLoss(before: string, after: string, lost: string): boolean {
  const chars = lost.trim().length
  const words = lost.match(/\S+/g)?.length ?? 0
  if (after.trim() === '' && before.trim().length >= 8) return true
  if (chars >= 25) return true
  if (words >= 3 && chars >= 12) return true
  return words >= 2 && chars >= 12 && chars / Math.max(1, before.trim().length) >= 0.6
}

// Bàn phím gõ có gạch chân/gợi ý (tiếng Việt Telex, autocorrect...) liên tục xóa và chèn: đó là đang gõ chứ không phải xóa.
const TYPING_NOISE = new Set(['deleteCompositionText', 'insertCompositionText', 'insertReplacementText', 'insertFromComposition', 'deleteByComposition'])

export function installTextUndo(): () => void {
  const undo = useUndo()
  let burst: { el: TextEl; kind: 'delete' | 'replace'; before: string; caret: number; selText: string; timer?: ReturnType<typeof setTimeout> } | null = null

  function flush() {
    if (!burst) return
    clearTimeout(burst.timer)
    const { el, kind, before, caret, selText } = burst
    burst = null
    if (!el.isConnected || el.value === before) return
    const after = el.value
    const lost = kind === 'replace' ? selText : lostText(before, after)
    if (!isSignificantLoss(before, after, lost)) return

    const wiped = after.trim() === ''
    const words = lost.match(/\S+/g)?.length ?? 0
    const id = undo.push({
      message: wiped ? 'Text cleared' : kind === 'replace' ? 'Text replaced' : words >= 3 ? `${words} words deleted` : 'Text deleted',
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
    // Người dùng gõ tiếp sau khi xóa: hoàn tác lúc này sẽ ghi đè phần vừa gõ, nên bỏ toast.
    if (id !== undefined) {
      const onEdit = () => {
        if (el.value === after) return
        undo.dismiss(id)
        el.removeEventListener('input', onEdit)
      }
      el.addEventListener('input', onEdit)
    }
  }

  function onBeforeInput(e: Event) {
    const ev = e as InputEvent
    const el = ev.target
    if (!isTextEl(el)) return
    const type = ev.inputType ?? ''
    if (ev.isComposing || TYPING_NOISE.has(type)) return
    // Cắt (cut) là chủ động và chữ vẫn nằm trong clipboard
    if (type === 'deleteByCut') {
      flush()
      return
    }

    const isDelete = type.startsWith('delete')
    const kind = isDelete ? 'delete' : 'replace'
    const start = el.selectionStart ?? 0
    const end = el.selectionEnd ?? 0
    const selText = el.value.slice(Math.min(start, end), Math.max(start, end))

    // Chốt lượt trước khi bắt đầu lượt khác: đổi ô nhập, chuyển giữa xóa và gõ/dán đè, hoặc gõ tiếp bình thường.
    if (burst && (burst.el !== el || burst.kind !== kind)) flush()
    if (!isDelete && selText.trim().length < 12) return // gõ bình thường, không đè lên vùng chọn lớn
    if (!burst) burst = { el, kind, before: el.value, caret: start, selText }
    else if (selText.length > burst.selText.length) burst.selText = selText
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
