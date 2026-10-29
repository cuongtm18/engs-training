<script setup lang="ts">
import type { Topic } from '~/utils/types'

const props = defineProps<{ modelValue: boolean; topic?: Topic }>()
const emit = defineEmits<{ 'update:modelValue': [boolean]; saved: [Topic]; deleted: [Topic] }>()

const store = useStore()
const confirm = useConfirm()
const undo = useUndo()
const topics = useTopics()

const name = ref('')
const emoji = ref('📚')
const color = ref(0)
const editing = computed(() => !!props.topic)

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    name.value = props.topic?.label ?? ''
    emoji.value = props.topic?.emoji ?? '📚'
    color.value = props.topic?.color ?? Math.floor(Math.random() * TOPIC_COLORS.length)
  },
  { immediate: true },
)

const close = () => emit('update:modelValue', false)

function save() {
  const label = name.value.trim()
  if (!label) return
  if (props.topic) {
    const changed = label !== props.topic.label || emoji.value !== props.topic.emoji || color.value !== props.topic.color
    const restore = store.updateTopic(props.topic.id, { label, emoji: emoji.value, color: color.value })
    if (changed) undo.push({ message: `Topic “${props.topic.label}” updated`, undo: restore })
    emit('saved', { ...props.topic, label, emoji: emoji.value, color: color.value })
  } else {
    emit('saved', store.addTopic(label, emoji.value, color.value))
  }
  close()
}

async function remove() {
  const t = props.topic
  if (!t) return
  const n = store.state.value.custom.filter((s) => s.t === t.id).length
  const ok = await confirm.ask(
    t.custom
      ? { title: `Delete “${t.label}”?`, message: `This also deletes its ${n} sentence${n === 1 ? '' : 's'} and your progress on them.`, confirmText: 'Delete topic' }
      : { title: `Remove “${t.label}”?`, message: 'The built-in sentences stay in the app. You can bring this topic back in Settings.', confirmText: 'Remove topic' },
  )
  if (!ok) return
  const restore = t.custom ? store.removeTopic(t.id) : store.hideTopic(t.id)
  undo.push({ message: t.custom ? `Topic “${t.label}” deleted` : `Topic “${t.label}” removed`, undo: restore, duration: 9000 })
  emit('deleted', t)
  close()
}
</script>

<template>
  <AppSheet :model-value="modelValue" :title="editing ? 'Edit topic' : 'New topic'" @update:model-value="emit('update:modelValue', $event)">
    <div class="preview" :style="{ '--c': TOPIC_COLORS[color] }">
      <span class="big">{{ emoji }}</span>
      <b>{{ name.trim() || 'Topic name' }}</b>
    </div>

    <label class="lbl">Name
      <input v-model="name" maxlength="40" placeholder="e.g. Job interview" autocomplete="off" @keydown.enter.prevent="save" />
    </label>

    <div class="lbl">Icon
      <div class="grid">
        <button v-for="e in TOPIC_EMOJIS" :key="e" class="cell" :class="{ on: emoji === e }" @click="emoji = e">{{ e }}</button>
      </div>
    </div>

    <div class="lbl">Color
      <div class="swatches">
        <button v-for="(c, i) in TOPIC_COLORS" :key="c" class="swatch-cell" :aria-label="`Color ${i + 1}`" :aria-pressed="color === i" @click="color = i"><i class="swatch" :class="{ on: color === i }" :style="{ background: c }" /></button>
      </div>
    </div>

    <button v-if="editing" class="btn danger" @click="remove">{{ topic?.custom ? 'Delete topic' : 'Remove topic' }}</button>

    <template #footer>
      <button class="btn primary block" :disabled="!name.trim()" @click="save">{{ editing ? 'Save' : 'Create topic' }}</button>
    </template>
  </AppSheet>
</template>

<style scoped>
.preview { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 20px; background: color-mix(in srgb, var(--c) 16%, var(--card)); border: 1px solid color-mix(in srgb, var(--c) 35%, var(--line)); }
.big { font-size: 2rem; }
.lbl { display: flex; flex-direction: column; gap: 8px; font-weight: 700; font-size: .9rem; }
.grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
.cell { appearance: none; border: 2px solid transparent; background: var(--card); border-radius: 14px; font-size: 1.4rem; padding: 8px 0; cursor: pointer; }
.cell.on { border-color: var(--accent); background: var(--soft); }
.swatches { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); }
.swatch-cell { appearance: none; border: 0; background: none; padding: 0; height: 44px; display: grid; place-items: center; cursor: pointer; }
.swatch { display: block; width: 30px; height: 30px; border-radius: 50%; border: 3px solid var(--bg); box-shadow: 0 0 0 1px var(--line); transition: box-shadow .12s, transform .12s; }
.swatch.on { box-shadow: 0 0 0 2.5px var(--ink); transform: scale(1.08); }
.btn.danger { color: var(--bad); background: var(--card); border: 1px solid var(--line); }
</style>
