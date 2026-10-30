// Câu khen/động viên thân thiện, hài hước. Xưng hô "em" với người học.
const POOLS = {
  // đúng cấu trúc và rất tự nhiên (>= 85%)
  perfect: [
    'Uây, em sắp thành người bản xứ rồi đấy! 🎉',
    'Em còn sáng nữa đấy! ✨',
    'Chuẩn không cần chỉnh! 👌',
    'Đỉnh của chóp! 🚀',
    'Em làm người bản xứ ghen tị rồi nhé 😎',
    'Nghe như em sống ở nước ngoài lâu năm rồi ấy! 🌍',
    'Câu này mà đem đi phỏng vấn là đậu ngay! 💼',
    'Chính xác luôn, không lăn tăn gì cả! 🎯',
    'Ôi trời, hay thế! Cho em một tràng pháo tay 👏',
    'Siêu! Tiếng Anh của em đang lên đời rồi 🔥',
    'Quá đã! Em đang bay rồi đấy 🕊️',
    'Giỏi dữ vậy! Mai em dạy lại mình nhé 😄',
  ],
  // gõ đúng y câu mẫu
  exact: [
    'Y chang đáp án mẫu luôn, em học bài kỹ ghê! 📚',
    'Trùng khớp hoàn toàn! Trí nhớ em tốt thật đấy 🧠',
    'Không sai một chữ nào, em đỉnh quá! 🏆',
    'Chuẩn từng chữ! Em là học sinh cưng của app rồi 💛',
  ],
  // đúng cấu trúc, cần tự nhiên hơn
  good: [
    'Đúng rồi! Thêm chút gia vị nữa là chuẩn bản xứ 🌶️',
    'Gần tới đích rồi, em giỏi lắm! 👍',
    'Ý chuẩn, chỉ cần mài thêm cho bóng thôi ✨',
    'Ổn áp rồi! Còn chút tự nhiên nữa là hoàn hảo 😉',
    'Người ta hiểu em ngay rồi, giờ làm cho mượt hơn thôi 🍃',
    "Đúng ý rồi, chỉ hơi 'sách giáo khoa' xíu thôi 📖",
    'Em làm tốt đấy! Chỉnh nhẹ là đỉnh 💪',
    'Còn một bước nữa là lên level mới 🎮',
  ],
  // chưa đúng cấu trúc hoặc ý nghĩa
  wrong: [
    'Chưa trúng đâu, nhưng em đang đi đúng hướng 🧭',
    'Sai một chút thôi, ai mà chẳng vấp! Thử lại nào 💪',
    'Không sao, lỗi sai là bạn thân của người học giỏi 🤝',
    'Ối, trượt rồi! Nhưng em sắp bắt được nó đó 🎣',
    'Chưa đúng, nhưng dám làm là giỏi rồi 🌱',
    'Hụt xíu thôi! Xem lại rồi mình chốt nhé 😄',
    'Câu này hơi lì, lần sau mình hạ gục nó nha 🥊',
    'Đừng nản nha, ai học cũng từng sai đoạn này 🫶',
  ],
  // bấm xem đáp án
  peek: [
    'Xem đáp án cũng là một cách học, lần sau em sẽ nhớ 😉',
    'Không sao, nhìn kỹ rồi nhớ nhé 📌',
    "Câu này sẽ quay lại sớm để em 'trả thù' 😎",
    'Biết đâu lần sau em lại nhớ ra ngay 💡',
  ],
  // cuối lượt, theo tỉ lệ câu đúng cấu trúc
  doneHigh: ['Xuất sắc! Em làm mình tự hào quá 🏆', 'Một lượt hoàn hảo! Nghỉ chút uống nước nha 🥤', 'Em đúng là cao thủ tiếng Anh tương lai 😎'],
  doneMid: ['Làm tốt lắm! Thêm một lượt nữa là nhớ luôn 🎉', 'Khá ghê! Ngày mai em sẽ còn giỏi hơn 🌟', 'Đều tay lắm, cứ giữ nhịp này nhé 🥁'],
  doneLow: ['Hôm nay hơi khó, nhưng em đã cố gắng rồi 💪', 'Sai nhiều cũng là học nhiều. Mai làm lại nhé 🌱', 'Những câu chưa đúng sẽ quay lại sớm, em đừng lo 🤗'],
} as const

export type PraiseKind = keyof typeof POOLS

/** Giữ icon cuối câu dính liền với từ trước nó để không bị rớt xuống dòng riêng. */
const glue = (s: string) => s.replace(/ ([^\p{L}\p{N}\s]+)$/u, '\u00A0$1')

const last: Partial<Record<PraiseKind, number>> = {}

/** Chọn ngẫu nhiên một câu, không lặp lại câu vừa dùng gần nhất của cùng loại. */
export function pickPraise(kind: PraiseKind): string {
  const pool = POOLS[kind]
  let i = Math.floor(Math.random() * pool.length)
  if (pool.length > 1 && i === last[kind]) i = (i + 1 + Math.floor(Math.random() * (pool.length - 1))) % pool.length
  last[kind] = i
  return glue(pool[i]!)
}

/** Khen khi đúng liên tiếp nhiều câu. Trả về null nếu chưa tới mốc. */
export function comboPraise(n: number): string | null {
  const lines: Record<number, string> = {
    3: 'Combo x3! Em đang vào form rồi đấy 🔥',
    5: 'Combo x5! Ai cản được em nữa không? 🚀',
    8: 'Combo x8! Em đang cháy thật sự luôn 🔥🔥',
    10: 'Combo x10! Quá đỉnh, em là máy học tiếng Anh à? 🤖',
    15: 'Combo x15! Mình xin nhường ngôi cho em 👑',
  }
  return lines[n] ? glue(lines[n]!) : null
}

export function donePraise(ok: number, total: number): string {
  const r = total ? ok / total : 0
  return pickPraise(r >= 0.9 ? 'doneHigh' : r >= 0.6 ? 'doneMid' : 'doneLow')
}
