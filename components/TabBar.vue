<script setup lang="ts">
const route = useRoute()
const tabs = [
  { to: '/', label: 'Topics', icon: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z' },
  { to: '/progress', label: 'Progress', icon: 'M5 20V10M12 20V4M19 20v-7' },
  { to: '/settings', label: 'Settings', icon: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3h0a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5h0a1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9v0a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z' },
]
const tap = () => navigator.vibrate?.(6)
const active = (to: string) => (to === '/' ? route.path === '/' : route.path.startsWith(to))
</script>

<template>
  <nav class="tabs" aria-label="Main">
    <NuxtLink v-for="t in tabs" :key="t.to" :to="t.to" class="tab" :class="{ on: active(t.to) }" @click="tap">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="t.icon" /></svg>
      <span>{{ t.label }}</span>
    </NuxtLink>
  </nav>
</template>

<style scoped>
.tabs { position: fixed; left: 0; right: 0; bottom: 0; z-index: 20; display: flex; justify-content: center; gap: 4px; padding: 6px 12px calc(6px + env(safe-area-inset-bottom)); background: color-mix(in srgb, var(--bg) 82%, transparent); backdrop-filter: blur(18px) saturate(1.4); border-top: 1px solid var(--line); }
.tab { flex: 1; max-width: 160px; display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 6px 0; border-radius: 14px; text-decoration: none; color: var(--muted); font-size: .7rem; font-weight: 600; transition: color .15s, transform .1s; }
.tab:active { transform: scale(.94); }
.tab.on { color: var(--accent); }
</style>
