// Safari iOS: khi bàn phím mở, "visual viewport" (vùng nhìn thấy) bị thu nhỏ và kéo lệch khỏi "layout viewport"
// (khung dùng để định vị position: fixed / sticky). Plugin này công bố vị trí thật của vùng nhìn thấy thành biến CSS:
//   --vv-top   khoảng lệch của vùng nhìn thấy so với đỉnh layout viewport
//   --vv-h     chiều cao vùng nhìn thấy (phần không bị bàn phím che)
//   --kb       khoảng cách từ đáy layout viewport tới đáy vùng nhìn thấy = chiều cao bàn phím đang che
//   --kb-open  1 khi bàn phím đang mở, 0 khi không
// Lưu ý: dùng documentElement.clientHeight (đúng khung của position: fixed), KHÔNG dùng window.innerHeight vì trên iOS
// nó lớn hơn clientHeight đúng bằng chiều cao thanh công cụ của Safari.
export default defineNuxtPlugin(() => {
  const root = document.documentElement
  const vv = window.visualViewport
  let raf = 0

  const apply = () => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(() => {
      const top = Math.max(0, vv?.offsetTop ?? 0)
      const h = vv?.height ?? root.clientHeight
      const kb = Math.max(0, Math.round(root.clientHeight - top - h))
      const open = kb > 80 // vài px lệch do làm tròn hoặc thanh địa chỉ co giãn không phải bàn phím
      root.style.setProperty('--vv-top', `${Math.round(top * 100) / 100}px`)
      root.style.setProperty('--vv-h', `${Math.round(h * 100) / 100}px`)
      root.style.setProperty('--kb', open ? `${kb}px` : '0px')
      root.style.setProperty('--kb-open', open ? '1' : '0')
    })
  }

  vv?.addEventListener('resize', apply)
  vv?.addEventListener('scroll', apply)
  window.addEventListener('resize', apply)
  window.addEventListener('orientationchange', apply)
  apply()
})
