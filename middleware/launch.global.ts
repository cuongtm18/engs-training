// App đã cài vào màn hình chính (standalone) mà bị tắt hẳn rồi mở lại thì luôn bắt đầu từ màn Topics,
// kể cả khi iOS mở lại đúng địa chỉ cũ (ví dụ trang Learn của một chủ đề).
// Phân biệt "mở mới" với "quay lại app đang chạy / tải lại để cập nhật" bằng sessionStorage:
// nó mất khi app bị tắt hẳn nhưng còn nguyên khi app chỉ ở nền hoặc reload.
const SESSION_KEY = 'engs.session'
let handled = false

export default defineNuxtRouteMiddleware((to) => {
  if (!import.meta.client || handled) return
  handled = true // chỉ xét ở lần điều hướng đầu tiên của mỗi lần tải trang

  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
  let fresh = true
  try {
    fresh = sessionStorage.getItem(SESSION_KEY) === null
    sessionStorage.setItem(SESSION_KEY, '1')
  } catch {
    /* sessionStorage bị chặn: coi như lần mở mới */
  }

  if (standalone && fresh && to.path !== '/') return navigateTo('/', { replace: true })
})
