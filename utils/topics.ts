import type { Topic } from './types'

export const TOPICS: Topic[] = [
  { id: 'cafe', label: 'Quán xá', emoji: '☕' },
  { id: 'travel', label: 'Đi lại', emoji: '🚌' },
  { id: 'work', label: 'Công việc', emoji: '💼' },
  { id: 'friends', label: 'Bạn bè', emoji: '💬' },
  { id: 'shop', label: 'Mua sắm', emoji: '🛍️' },
  { id: 'daily', label: 'Đời sống', emoji: '🏠' },
]

export const LEVELS = [
  { id: 1, label: 'Dễ' },
  { id: 2, label: 'Vừa' },
  { id: 3, label: 'Khó' },
] as const
