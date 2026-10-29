// PWA dùng như native app: chặn zoom (pinch, ctrl+wheel/phím tắt). Double-tap zoom đã tắt bằng touch-action trong app.vue.
export default defineNuxtPlugin(() => {
  const block = (e: Event) => e.preventDefault()

  // iOS Safari bỏ qua user-scalable=no, nên chặn pinch qua gesture events.
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, block, { passive: false })
  }

  // Pinch trên desktop/trackpad (ctrl + wheel) và ctrl +/-/0.
  document.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault() }, { passive: false })
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && ['+', '=', '-', '0'].includes(e.key)) e.preventDefault()
  })
})
