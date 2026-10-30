/** Rung nhẹ khi thao tác. Chỉ rung sau khi người dùng đã chạm vào trang (nếu không Chrome ghi cảnh báo vào console). */
export function haptic(ms: number) {
  if (!import.meta.client || !navigator.vibrate) return
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return
  navigator.vibrate(ms)
}
