// Ấn giữ một thẻ rồi kéo để đổi vị trí (cảm ứng và chuột). Các thẻ khác tự dịch chỗ, kéo sát mép màn hình thì tự cuộn.
import type { Ref } from 'vue'

const HOLD_MS = 380 // ấn giữ bao lâu thì bắt đầu kéo
const SLOP = 8 // di chuyển quá ngưỡng này trước khi đủ giờ = người dùng đang cuộn, không phải kéo
const EDGE = 90 // vùng sát mép màn hình để tự cuộn

interface Slot {
  id: string
  top: number
  height: number
}

export function useReorder(opts: { container: Ref<HTMLElement | undefined>; ids: () => string[]; onCommit: (ids: string[]) => void }) {
  const draggingId = ref<string | null>(null)
  const dy = ref(0)
  const shift = reactive<Record<string, number>>({})
  const active = computed(() => draggingId.value !== null)

  let timer: ReturnType<typeof setTimeout> | undefined
  let pressId = ''
  let pressX = 0
  let pressY = 0
  let startScroll = 0
  let lastY = 0
  let slots: Slot[] = []
  let from = 0
  let to = 0
  let raf = 0
  let gap = 10
  let kind: 'touch' | 'mouse' | null = null

  const interactive = (el: Element | null) => !!el?.closest('button, a, input, textarea, select, summary, [contenteditable]')

  function press(target: EventTarget | null, x: number, y: number, k: 'touch' | 'mouse') {
    const el = (target as Element | null)?.closest?.('[data-sid]') ?? null
    if (!el || interactive(target as Element)) return
    cancelPress()
    pressId = el.getAttribute('data-sid')!
    pressX = x
    pressY = lastY = y
    kind = k
    timer = setTimeout(activate, HOLD_MS)
    if (k === 'touch') {
      document.addEventListener('touchmove', onTouchMove, { passive: false })
      document.addEventListener('touchend', onEnd)
      document.addEventListener('touchcancel', onCancel)
    } else {
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onEnd)
    }
  }

  function cancelPress() {
    clearTimeout(timer)
    document.removeEventListener('touchmove', onTouchMove)
    document.removeEventListener('touchend', onEnd)
    document.removeEventListener('touchcancel', onCancel)
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onEnd)
    document.removeEventListener('keydown', onKey)
    cancelAnimationFrame(raf)
    kind = null
  }

  function activate() {
    const root = opts.container.value
    if (!root) return cancelPress()
    const ids = opts.ids()
    from = ids.indexOf(pressId)
    if (from < 0) return cancelPress()
    slots = ids.map((id) => {
      const r = root.querySelector(`[data-sid="${CSS.escape(id)}"]`)!.getBoundingClientRect()
      return { id, top: r.top + scrollY, height: r.height }
    })
    gap = slots.length > 1 ? Math.max(0, slots[1]!.top - (slots[0]!.top + slots[0]!.height)) : 10
    startScroll = scrollY
    to = from
    dy.value = 0
    draggingId.value = pressId
    haptic(14)
    document.addEventListener('keydown', onKey)
    loop()
  }

  function update(y: number) {
    lastY = y
    if (!active.value) return
    const me = slots[from]!
    const first = slots[0]!
    const last = slots[slots.length - 1]!
    // follow the finger, accounting for page scroll, and stay inside the list
    let d = y + scrollY - (pressY + startScroll)
    d = Math.max(first.top - me.top, Math.min(last.top + last.height - (me.top + me.height), d))
    dy.value = d
    const center = me.top + me.height / 2 + d
    // new index = how many OTHER cards stay above the dragged card. When the middles line up (within 1px) the card
    // counts as having moved past its neighbour, in both directions.
    let idx = 0
    slots.forEach((s, i) => {
      if (i === from) return
      const mid = s.top + s.height / 2
      if (i < from ? mid < center - 1 : mid <= center + 1) idx++
    })
    if (idx !== to) {
      to = idx
      haptic(8)
    }
    const push = me.height + gap
    slots.forEach((s, i) => {
      if (i === from) return
      shift[s.id] = from < to && i > from && i <= to ? -push : from > to && i >= to && i < from ? push : 0
    })
  }

  // auto-scroll when the finger is near the top or bottom edge
  function loop() {
    if (!active.value) return
    const speed = lastY < EDGE ? -Math.ceil((EDGE - lastY) / 6) : lastY > innerHeight - EDGE ? Math.ceil((lastY - (innerHeight - EDGE)) / 6) : 0
    if (speed) {
      scrollBy(0, speed)
      update(lastY)
    }
    raf = requestAnimationFrame(loop)
  }

  function onTouchMove(e: TouchEvent) {
    const t = e.touches[0]
    if (!t) return
    if (active.value) {
      e.preventDefault() // the long press happened before any scrolling started, so this stops the page from scrolling
      update(t.clientY)
    } else if (Math.abs(t.clientY - pressY) > SLOP || Math.abs(t.clientX - pressX) > SLOP) {
      cancelPress() // the finger moved first: it's a normal scroll or swipe
    }
  }

  function onMouseMove(e: MouseEvent) {
    if (active.value) update(e.clientY)
    else if (Math.abs(e.clientY - pressY) > SLOP || Math.abs(e.clientX - pressX) > SLOP) cancelPress()
  }

  function finish(commit: boolean) {
    const was = active.value
    const ids = opts.ids()
    const moved = was && commit && to !== from
    cancelPress()
    if (!was) return
    let next = ids
    if (moved) {
      next = [...ids]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item!)
    }
    // clear the transforms in the same tick as the list re-renders, so cards land exactly in their slots
    draggingId.value = null
    dy.value = 0
    for (const k of Object.keys(shift)) delete shift[k]
    if (moved) opts.onCommit(next)
  }

  const onEnd = () => finish(true)
  const onCancel = () => finish(false)
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') finish(false)
  }

  /** Style for one card while a drag is in progress. */
  function itemStyle(id: string) {
    if (!active.value) return undefined
    if (id === draggingId.value) return { transform: `translateY(${dy.value}px) scale(1.02)`, transition: 'none', zIndex: 5, position: 'relative' as const, filter: 'drop-shadow(0 14px 22px rgba(0,0,0,.28))' }
    return { transform: `translateY(${shift[id] ?? 0}px)`, transition: 'transform .18s cubic-bezier(.2,.8,.2,1)', position: 'relative' as const }
  }

  onBeforeUnmount(cancelPress)

  return {
    active,
    draggingId,
    itemStyle,
    onTouchStart: (e: TouchEvent) => e.touches.length === 1 && press(e.target, e.touches[0]!.clientX, e.touches[0]!.clientY, 'touch'),
    onMouseDown: (e: MouseEvent) => e.button === 0 && press(e.target, e.clientX, e.clientY, 'mouse'),
  }
}
