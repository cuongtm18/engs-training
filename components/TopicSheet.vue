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
const icon = ref('')
const fileInput = ref<HTMLInputElement>()
const uploadErr = ref('')
const pickerOpen = ref(false)
const color = ref(0)
const editing = computed(() => !!props.topic)

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    name.value = props.topic?.label ?? ''
    emoji.value = props.topic?.emoji ?? '📚'
    icon.value = props.topic?.icon ?? ''
    uploadErr.value = ''
    pickerOpen.value = false
    color.value = props.topic?.color ?? Math.floor(Math.random() * TOPIC_COLORS.length)
  },
  { immediate: true },
)

const close = () => emit('update:modelValue', false)

function save() {
  const label = name.value.trim()
  if (!label) return
  if (props.topic) {
    const changed = label !== props.topic.label || emoji.value !== props.topic.emoji || color.value !== props.topic.color || icon.value !== (props.topic.icon ?? '')
    const restore = store.updateTopic(props.topic.id, { label, emoji: emoji.value, color: color.value, icon: icon.value })
    if (changed) undo.push({ message: `Topic “${props.topic.label}” updated`, undo: restore })
    emit('saved', { ...props.topic, label, emoji: emoji.value, color: color.value, icon: icon.value || undefined })
  } else {
    emit('saved', store.addTopic(label, emoji.value, color.value, icon.value))
  }
  close()
}

/** Thu nhỏ ảnh về 128px vuông (cắt giữa) để lưu gọn trong localStorage. */
async function onFile(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (!f) return
  uploadErr.value = ''
  if (!f.type.startsWith('image/')) return (uploadErr.value = 'Please choose an image file.')
  try {
    const bmp = await createImageBitmap(f)
    const size = 128
    const side = Math.min(bmp.width, bmp.height)
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    canvas.getContext('2d')!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size)
    icon.value = canvas.toDataURL('image/webp', 0.85)
    pickerOpen.value = false
  } catch {
    uploadErr.value = 'Could not read that image.'
  }
}

function pick(e: string) {
  emoji.value = e
  icon.value = ''
  pickerOpen.value = false
}

/** Cho phép gõ/dán emoji bất kỳ, kể cả từ bàn phím emoji của hệ điều hành (iPhone, Android…); lấy emoji vừa nhập cuối cùng. */
const EMOJI_RE = /\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]\uFE0F?\u20E3/u
function onEmojiInput(e: Event) {
  const input = e.target as HTMLInputElement
  if ((e as InputEvent).isComposing) return
  const chars = typeof Intl.Segmenter === 'function' ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(input.value)].map((x) => x.segment) : [...input.value]
  const picked = chars.filter((c) => EMOJI_RE.test(c)).pop()
  input.value = ''
  if (picked) pick(picked)
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
      <TopicIcon :emoji="emoji" :icon="icon" :size="44" />
      <b>{{ name.trim() || 'Topic name' }}</b>
    </div>

    <label class="lbl">Name
      <input v-model="name" maxlength="40" placeholder="e.g. Job interview" autocomplete="off" @keydown.enter.prevent="save" />
    </label>

    <div class="lbl">Icon
      <button class="icon-pick" @click="pickerOpen = true">
        <TopicIcon :emoji="emoji" :icon="icon" :size="34" />
        <span class="grow">Change icon</span>
        <AppIcon name="chevron-left" :size="16" class="chev" />
      </button>
    </div>

    <div class="lbl">Color
      <div class="swatches">
        <button v-for="(c, i) in TOPIC_COLORS" :key="c" class="swatch-cell" :aria-label="`Color ${i + 1}`" :aria-pressed="color === i" @click="color = i"><i class="swatch" :class="{ on: color === i }" :style="{ background: c }" /></button>
      </div>
    </div>

    <button v-if="editing" class="btn danger" @click="remove">{{ topic?.custom ? 'Delete topic' : 'Remove topic' }}</button>

    <Teleport to="body">
      <Transition name="pop">
        <div v-if="pickerOpen && modelValue" class="pop-root" role="dialog" aria-modal="true" aria-label="Choose icon">
          <div class="pop-bg" @click="pickerOpen = false" />
          <div class="pop">
            <div class="pop-head">
              <b>Choose icon</b>
              <button class="x" aria-label="Close" @click="pickerOpen = false"><AppIcon name="x" :size="16" /></button>
            </div>
            <div class="grid">
              <button v-for="e in TOPIC_EMOJIS" :key="e" class="cell" :class="{ on: !icon && emoji === e }" @click="pick(e)">{{ e }}</button>
            </div>
            <input class="emoji-in" placeholder="😀  Or tap here and use your keyboard's emoji" aria-label="Type any emoji" autocomplete="off" @input="onEmojiInput" />
            <button class="btn block" @click="fileInput?.click()"><AppIcon name="plus" :size="18" /> Upload your own image</button>
            <span v-if="uploadErr" class="err">{{ uploadErr }}</span>
            <button v-if="icon" class="link" @click="icon = ''; pickerOpen = false">Remove uploaded image</button>
            <input ref="fileInput" type="file" accept="image/*" hidden @change="onFile" />
          </div>
        </div>
      </Transition>
    </Teleport>

    <template #footer>
      <button class="btn primary block" :disabled="!name.trim()" @click="save">{{ editing ? 'Save' : 'Create topic' }}</button>
    </template>
  </AppSheet>
</template>

<style scoped>
.preview { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 20px; background: color-mix(in srgb, var(--c) 16%, var(--card)); border: 1px solid color-mix(in srgb, var(--c) 35%, var(--line)); }
.lbl { display: flex; flex-direction: column; gap: 8px; font-weight: 700; font-size: .9rem; }
.grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; max-height: 260px; overflow-y: auto; overscroll-behavior: contain; }
.emoji-in { font-weight: 400; }
.icon-pick { appearance: none; display: flex; align-items: center; gap: 12px; width: 100%; min-height: 52px; padding: 8px 14px; border-radius: 16px; border: 1px solid var(--line); background: var(--card); color: var(--ink); font: inherit; font-weight: 600; text-align: left; cursor: pointer; }
.chev { transform: rotate(180deg); color: var(--muted); }
.pop-root { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 16px; }
.pop-bg { position: absolute; inset: 0; background: rgba(20, 12, 4, .45); }
.pop { position: relative; width: 100%; max-width: 380px; max-height: 86dvh; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; padding: 16px; border-radius: 24px; background: var(--bg); box-shadow: 0 20px 50px rgba(0, 0, 0, .35); }
.pop-head { display: flex; align-items: center; justify-content: space-between; }
.pop-head .x { appearance: none; border: 0; width: 36px; height: 36px; border-radius: 50%; background: var(--soft); color: var(--ink); display: grid; place-items: center; cursor: pointer; padding: 0; }
.pop .grid { max-height: 240px; }
.pop-enter-active, .pop-leave-active { transition: opacity .18s; }
.pop-enter-active .pop, .pop-leave-active .pop { transition: transform .2s; }
.pop-enter-from, .pop-leave-to { opacity: 0; }
.pop-enter-from .pop, .pop-leave-to .pop { transform: scale(.94); }
.cell { appearance: none; border: 2px solid transparent; background: var(--card); border-radius: 14px; font-size: 1.4rem; padding: 8px 0; cursor: pointer; }
.link { appearance: none; border: 0; background: none; padding: 0; font: inherit; font-weight: 650; color: var(--accent); cursor: pointer; }
.err { font-weight: 500; font-size: .82rem; color: var(--bad); }
.cell.on { border-color: var(--accent); background: var(--soft); }
.swatches { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); }
.swatch-cell { appearance: none; border: 0; background: none; padding: 0; height: 44px; display: grid; place-items: center; cursor: pointer; }
.swatch { display: block; width: 30px; height: 30px; border-radius: 50%; border: 3px solid var(--bg); box-shadow: 0 0 0 1px var(--line); transition: box-shadow .12s, transform .12s; }
.swatch.on { box-shadow: 0 0 0 2.5px var(--ink); transform: scale(1.08); }
.btn.danger { color: var(--bad); background: var(--card); border: 1px solid var(--line); }
</style>
