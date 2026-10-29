// Hộp xác nhận kiểu action sheet, thay cho window.confirm.
interface ConfirmState {
  open: boolean
  title: string
  message: string
  confirmText: string
  destructive: boolean
  resolve?: (v: boolean) => void
}

const state = reactive<ConfirmState>({ open: false, title: '', message: '', confirmText: 'OK', destructive: true })

export function useConfirmState() {
  return state
}

export function useConfirm() {
  return {
    ask(opts: { title: string; message?: string; confirmText?: string; destructive?: boolean }): Promise<boolean> {
      state.resolve?.(false)
      Object.assign(state, { title: opts.title, message: opts.message ?? '', confirmText: opts.confirmText ?? 'Delete', destructive: opts.destructive ?? true, open: true })
      return new Promise((resolve) => (state.resolve = resolve))
    },
  }
}
