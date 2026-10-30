<script setup lang="ts">
import type { CheckResult } from '~/utils/types'

const props = defineProps<{ answer: string; result: CheckResult; uid: number }>()

const corrected = computed(() => props.result.corrected?.trim() ?? '')
const unchanged = computed(() => !!corrected.value && sameSentence(corrected.value, props.answer))
const tokens = computed(() => highlightChanges(props.answer, corrected.value))
// "Câu gợi ý" only when it adds something beyond the corrected sentence
const showSuggest = computed(() => !!props.result.natural && !(corrected.value && sameSentence(props.result.natural, corrected.value)))
const level = computed(() => (!props.result.structureOk ? 'no' : props.result.naturalness >= 85 ? 'hi' : props.result.naturalness >= 50 ? 'mid' : 'lo'))
</script>

<template>
  <div class="fb">
    <span class="score" :class="level" :title="result.engine === 'offline' ? 'Ước lượng offline' : undefined">
      <AppIcon :name="result.structureOk ? 'check' : 'x'" :size="12" :stroke="3.2" />
      <template v-if="result.structureOk">{{ result.naturalness }}%</template>
      <template v-if="result.engine === 'offline'"> · offline</template>
    </span>

    <div v-if="corrected" class="blk">
      <div class="grow">
        <span class="lbl">Sửa câu của bạn:</span>
        <p v-if="unchanged" class="good"><AppIcon name="check" :size="15" :stroke="3" /> Đúng rồi, không cần sửa</p>
        <p v-else class="sent"><template v-for="(t, i) in tokens" :key="i"><span :class="{ chg: t.changed }">{{ t.text }}</span>{{ ' ' }}</template></p>
      </div>
      <SpeakButton v-if="!showSuggest" :id="`fb-${uid}`" :text="result.natural || corrected" class="sp" />
    </div>

    <div v-if="showSuggest" class="blk">
      <div class="grow">
        <span class="lbl">Câu gợi ý:</span>
        <p class="sent">{{ result.natural }}</p>
      </div>
      <SpeakButton :id="`fb-${uid}`" :text="result.natural" class="sp" />
    </div>
  </div>
</template>

<style scoped>
.fb { position: relative; display: flex; flex-direction: column; gap: 10px; text-align: left; }
.score { position: absolute; top: -2px; right: -2px; display: inline-flex; align-items: center; gap: 3px; font-size: .74rem; font-weight: 800; line-height: 1; padding: 5px 8px; border-radius: 99px; background: var(--soft); }
.score.hi { background: var(--good-bg); color: var(--good); }
.score.mid { background: var(--warn-bg); color: var(--warn); }
.score.lo, .score.no { background: var(--bad-bg); color: var(--bad); }
.blk { display: flex; align-items: center; gap: 6px; }
.blk:first-of-type { padding-right: 62px; } /* room for the score pill */
.blk + .blk { padding-right: 0; }
.lbl { display: block; font-size: .74rem; font-weight: 650; color: var(--muted); margin-bottom: 2px; }
.sent { margin: 0; font-size: 1.02rem; font-weight: 650; line-height: 1.35; overflow-wrap: anywhere; }
.chg { color: var(--accent); text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 3px; text-decoration-color: color-mix(in srgb, var(--accent) 55%, transparent); }
.good { margin: 0; display: inline-flex; align-items: center; gap: 5px; font-weight: 700; color: var(--good); }
.sp { width: 44px; height: 44px; }
.blk:has(.sp) { padding-right: 0; }
</style>
