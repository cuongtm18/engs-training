import type { Topic } from './types'

export const TOPICS: Topic[] = [
  { id: 'cafe', label: 'Quán xá', emoji: '☕' },
  { id: 'travel', label: 'Đi lại', emoji: '🚌' },
  { id: 'dir', label: 'Hỏi đường', emoji: '🧭' },
  { id: 'work', label: 'Công việc', emoji: '💼' },
  { id: 'friends', label: 'Bạn bè', emoji: '💬' },
  { id: 'shop', label: 'Mua sắm', emoji: '🛍️' },
  { id: 'daily', label: 'Đời sống', emoji: '🏠' },
  { id: 'mine', label: 'Câu của tôi', emoji: '✍️' },
]

export const topicById = (id: string) => TOPICS.find((t) => t.id === id)
