<script setup lang="ts">
import type { CheckResult, Sentence } from '~/utils/types'

const props = defineProps<{ result: CheckResult; praise: string; sentence: Sentence; uid: number }>()
const nat = computed(() => (props.result.naturalness >= 85 ? 'hi' : props.result.naturalness >= 50 ? 'mid' : 'lo'))
const more = computed(() => [...new Set([props.sentence.en, ...(props.sentence.alt ?? [])])].filter((a) => a !== props.result.natural))
</script>

<template>
  <div class="reply">
    <p class="praise">{{ praise }}</p>

    <div class="chips">
      <span class="pill" :class="result.structureOk ? 'ok' : 'no'">
        <AppIcon :name="result.structureOk ? 'check' : 'x'" :size="13" :stroke="3" />
        {{ result.structureOk ? 'Đúng cấu trúc' : 'Chưa đúng cấu trúc' }}
      </span>
      <span v-if="result.structureOk" class="pill" :class="nat">{{ result.naturalness }}% tự nhiên</span>
      <span v-if="result.engine === 'offline'" class="pill off">offline</span>
    </div>
    <div v-if="result.structureOk" class="meter" aria-hidden="true"><i :class="nat" :style="{ width: result.naturalness + '%' }" /></div>

    <div class="natural">
      <div class="grow">
        <span class="lbl">Cách nói tự nhiên</span>
        <b class="en">{{ result.natural }}</b>
      </div>
      <SpeakButton :id="`chat-${sentence.id}-${uid}`" :text="result.natural" />
    </div>

    <p class="expl">{{ result.explanation }}</p>

    <details v-if="more.length || sentence.note" class="more">
      <summary>Các cách nói khác</summary>
      <ul v-if="more.length"><li v-for="a in more" :key="a">{{ a }}</li></ul>
      <p v-if="sentence.note" class="note">💡 {{ sentence.note }}</p>
    </details>
  </div>
</template>

<style scoped>
.reply { display: flex; flex-direction: column; gap: 8px; }
.praise { margin: 0; font-weight: 750; line-height: 1.3; text-wrap: balance; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.pill { display: inline-flex; align-items: center; gap: 4px; font-size: .78rem; font-weight: 700; line-height: 1; padding: 5px 9px; border-radius: 99px; background: var(--soft); }
.pill.ok, .pill.hi { background: var(--good-bg); color: var(--good); }
.pill.no, .pill.lo { background: var(--bad-bg); color: var(--bad); }
.pill.mid { background: var(--warn-bg); color: var(--warn); }
.pill.off { color: var(--muted); }
.meter { height: 6px; border-radius: 99px; background: var(--soft); overflow: hidden; }
.meter i { display: block; height: 100%; border-radius: 99px; transition: width .5s; }
.meter i.hi { background: var(--good); }
.meter i.mid { background: var(--warn); }
.meter i.lo { background: var(--bad); }
.natural { display: flex; align-items: center; gap: 8px; padding: 8px 8px 8px 12px; border-radius: 14px; background: color-mix(in srgb, var(--accent) 9%, var(--card)); border: 1px solid color-mix(in srgb, var(--accent) 22%, var(--line)); }
.lbl { display: block; font-size: .72rem; color: var(--muted); margin-bottom: 1px; }
.en { font-size: 1.02rem; line-height: 1.3; }
.expl { margin: 0; font-size: .95rem; line-height: 1.4; }
.more { font-size: .9rem; }
.more summary { cursor: pointer; color: var(--muted); padding: 8px 0; margin: -4px 0; }
.more ul { margin: 2px 0 6px; padding-left: 20px; }
.note { margin: 4px 0 0; }
</style>
