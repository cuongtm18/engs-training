<script setup lang="ts">
const props = withDefaults(defineProps<{ value: number; size?: number; stroke?: number; color?: string }>(), { size: 44, stroke: 5, color: 'var(--accent)' })
const r = computed(() => (props.size - props.stroke) / 2)
const c = computed(() => 2 * Math.PI * r.value)
const off = computed(() => c.value * (1 - Math.min(1, Math.max(0, props.value))))
</script>

<template>
  <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`" aria-hidden="true">
    <circle :cx="size / 2" :cy="size / 2" :r="r" fill="none" :stroke-width="stroke" stroke="currentColor" opacity=".12" />
    <circle :cx="size / 2" :cy="size / 2" :r="r" fill="none" :stroke-width="stroke" :stroke="color" stroke-linecap="round" :stroke-dasharray="c" :stroke-dashoffset="off" :transform="`rotate(-90 ${size / 2} ${size / 2})`" style="transition: stroke-dashoffset .5s" />
  </svg>
</template>
