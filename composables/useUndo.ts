// Toast hoàn tác dùng chung. Hiện ở phía trên màn hình để không nằm dưới ngón tay vừa bấm xóa.
export interface UndoToast {
  id: number
  message: string
  undo?: () => void
  duration: number
  /** Nút Undo chỉ bấm được sau một nhịp ngắn, tránh bấm nhầm khi vừa chạm nút xóa */
  armed: boolean
}

const MAX = 3
const ARM_MS = 350
const toasts = ref<UndoToast[]>([])
let seq = 0
let lastKey = ''
let lastAt = 0

export function useUndoState() {
  return toasts
}

function dismiss(id: number) {
  toasts.value = toasts.value.filter((t) => t.id !== id)
}

export function useUndo() {
  return {
    /** Hiện toast. Không truyền `undo` thì chỉ là thông báo có nút đóng. */
    push(opts: { message: string; undo?: () => void; duration?: number }) {
      // chống nháy: cùng một thông báo bắn liên tiếp trong 300ms thì chỉ giữ một
      const key = opts.message
      const now = Date.now()
      if (key === lastKey && now - lastAt < 300) return
      lastKey = key
      lastAt = now

      const id = ++seq
      const toast: UndoToast = { id, message: opts.message, undo: opts.undo, duration: opts.duration ?? 7000, armed: false }
      toasts.value = [toast, ...toasts.value].slice(0, MAX)
      setTimeout(() => {
        const t = toasts.value.find((x) => x.id === id)
        if (t) t.armed = true
      }, ARM_MS)
      haptic(8)
      return id
    },
    dismiss,
    /** Chạy hoàn tác của toast rồi đóng nó. Chỉ chạy một lần dù bấm đúp. */
    run(id: number) {
      const t = toasts.value.find((x) => x.id === id)
      if (!t || !t.armed || !t.undo) return
      const fn = t.undo
      t.undo = undefined
      dismiss(id)
      fn()
      haptic(12)
    },
    /** Hoàn tác thao tác mới nhất (phím tắt Ctrl/Cmd+Z). */
    runLatest() {
      const t = toasts.value.find((x) => x.undo)
      if (t) this.run(t.id)
      return !!t
    },
  }
}
