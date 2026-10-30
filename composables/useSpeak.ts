// Đọc to bằng speechSynthesis, có trạng thái "đang đọc" để nút nghe hiện hiệu ứng và tự tắt khi xong.
const speakingId = ref<string | null>(null)
let token = 0
let poll: ReturnType<typeof setInterval> | undefined

const isSupported = () => import.meta.client && 'speechSynthesis' in window

function finish() {
  speakingId.value = null
  clearInterval(poll)
  poll = undefined
}

/** Dừng mọi giọng đang đọc và tắt hiệu ứng. */
export function stopSpeaking() {
  token++
  if (isSupported()) speechSynthesis.cancel()
  finish()
}

let hooked = false

export function useSpeak() {
  if (import.meta.client && !hooked) {
    hooked = true
    window.addEventListener('pagehide', stopSpeaking) // the OS may keep talking after the tab is hidden
  }
  const supported = computed(() => isSupported())

  /** Bấm lần đầu: đọc. Bấm lại khi đang đọc chính câu đó: dừng. Bấm câu khác: chuyển sang câu mới. */
  function toggle(id: string, text: string) {
    if (!isSupported()) return
    if (speakingId.value === id) return stopSpeaking()

    speechSynthesis.cancel()
    clearInterval(poll)
    const mine = ++token
    const startedAt = Date.now()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'en-US'
    u.rate = 0.95
    // sự kiện của câu cũ bị cancel() sẽ tới muộn: bỏ qua nếu không còn là lượt hiện tại
    u.onend = () => mine === token && finish()
    u.onerror = () => mine === token && finish()
    speakingId.value = id // bật hiệu ứng ngay khi bấm, không đợi sự kiện bắt đầu
    speechSynthesis.speak(u)

    // Một số trình duyệt (nhất là iOS Safari) đôi khi không bắn onend: kiểm tra định kỳ để hiệu ứng không bị kẹt
    poll = setInterval(() => {
      if (mine !== token) return clearInterval(poll)
      if (Date.now() - startedAt > 1500 && !speechSynthesis.speaking && !speechSynthesis.pending) finish()
    }, 400)
  }

  return { supported, speakingId, toggle, stop: stopSpeaking }
}
