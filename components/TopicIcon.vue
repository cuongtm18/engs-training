<script setup lang="ts">
// Hiển thị ảnh tự tải lên nếu có, không thì emoji của chủ đề.
withDefaults(defineProps<{ emoji: string; icon?: string; size?: number }>(), { size: 40 })
</script>

<template>
  <span class="ti" :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${size * 0.82}px` }">
    <img v-if="icon" :src="icon" alt="" draggable="false" />
    <template v-else>{{ emoji }}</template>
  </span>
</template>

<style scoped>
.ti { display: inline-grid; place-items: center; flex: none; line-height: 1; }
.ti img { width: 100%; height: 100%; object-fit: cover; border-radius: 22%; display: block; }
</style>
