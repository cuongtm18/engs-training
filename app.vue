<script setup lang="ts">
const route = useRoute()
const showTabs = computed(() => ['/', '/progress', '/settings'].includes(route.path))
</script>

<template>
  <div class="shell" :class="{ tabs: showTabs }">
    <NuxtPage />
  </div>
  <TabBar v-if="showTabs" />
  <ConfirmHost />
</template>

<style>
:root {
  --bg: #fbf3e8;
  --card: #fffdf9;
  --ink: #2b2118;
  --muted: #8c7a68;
  --line: #eddcc7;
  --accent: #ee8433;
  --accent-ink: #fff;
  --soft: #f9e4cb;
  --good: #2e9b5f;
  --good-bg: #e0f3e7;
  --bad: #d4493b;
  --bad-bg: #fbe3df;
  --warn: #b7791f;
  --warn-bg: #fdf1d3;
  --shadow: 0 1px 2px rgba(70, 40, 10, .05), 0 8px 24px rgba(70, 40, 10, .06);
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #17120e;
    --card: #241d17;
    --ink: #f4ebe1;
    --muted: #a8998a;
    --line: #382e25;
    --soft: #3a2a1c;
    --good-bg: #17331f;
    --bad-bg: #3a1c18;
    --warn-bg: #3a2f14;
    --good: #5fd08c;
    --bad: #ff8577;
    --warn: #f0c060;
    --shadow: 0 1px 2px rgba(0, 0, 0, .3), 0 8px 24px rgba(0, 0, 0, .25);
    color-scheme: dark;
  }
}
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body { margin: 0; background: var(--bg); color: var(--ink); overscroll-behavior-y: none; }
body { font: 16px/1.45 -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, system-ui, sans-serif; -webkit-font-smoothing: antialiased; -webkit-touch-callout: none; }
button, a, nav, header { user-select: none; -webkit-user-select: none; }
input, textarea { user-select: text; -webkit-user-select: text; }

.shell { max-width: 560px; margin: 0 auto; padding: calc(12px + env(safe-area-inset-top)) 16px calc(28px + env(safe-area-inset-bottom)); min-height: 100dvh; }
.shell.tabs { padding-bottom: calc(96px + env(safe-area-inset-bottom)); }

/* page transitions */
.page-enter-active, .page-leave-active { transition: opacity .16s ease, transform .2s ease; }
.page-enter-from { opacity: 0; transform: translateX(14px); }
.page-leave-to { opacity: 0; transform: translateX(-10px); }
@media (prefers-reduced-motion: reduce) { .page-enter-active, .page-leave-active { transition: none; } }

h1 { font-size: 1.5rem; margin: 0; letter-spacing: -.02em; }
h2 { font-size: 1.05rem; margin: 0 0 8px; }
.large-title { font-size: 2.1rem; font-weight: 800; letter-spacing: -.03em; margin: 0; }
.muted { color: var(--muted); }
.small { font-size: .85rem; }
.row { display: flex; gap: 10px; align-items: center; }
.wrap { flex-wrap: wrap; }
.grow { flex: 1; min-width: 0; }

.card { background: var(--card); border: 1px solid var(--line); border-radius: 22px; padding: 16px; box-shadow: var(--shadow); }

.btn { appearance: none; border: 0; border-radius: 16px; padding: 12px 18px; font: inherit; font-weight: 650; cursor: pointer; background: var(--soft); color: var(--ink); min-height: 48px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; text-decoration: none; transition: transform .1s, opacity .15s, filter .15s; }
.btn:active:not(:disabled) { transform: scale(.97); filter: brightness(.97); }
.btn:disabled { opacity: .45; cursor: default; }
.btn.primary { background: var(--accent); color: var(--accent-ink); box-shadow: 0 4px 14px color-mix(in srgb, var(--accent) 35%, transparent); }
.btn.block { width: 100%; }
.btn.ghost { background: transparent; border: 1px solid var(--line); }
.icon-btn { appearance: none; border: 0; width: 40px; height: 40px; border-radius: 50%; background: var(--card); border: 1px solid var(--line); color: var(--ink); font: inherit; font-size: 1.1rem; cursor: pointer; display: inline-grid; place-items: center; text-decoration: none; box-shadow: var(--shadow); transition: transform .1s; }
.icon-btn:active { transform: scale(.92); }

/* segmented control */
.seg { display: flex; background: var(--soft); border-radius: 14px; padding: 3px; gap: 2px; }
.seg button { flex: 1; appearance: none; border: 0; background: transparent; color: var(--ink); font: inherit; font-weight: 650; border-radius: 11px; padding: 9px 10px; min-height: 40px; cursor: pointer; transition: background .15s, box-shadow .15s; }
.seg button.on { background: var(--card); box-shadow: 0 1px 4px rgba(0, 0, 0, .12); }
.seg.small button { min-height: 34px; padding: 5px 14px; }

/* pushed-screen navigation bar */
.nav { position: sticky; top: 0; z-index: 10; display: flex; align-items: center; gap: 10px; margin: 0 -16px 10px; padding: calc(8px + env(safe-area-inset-top)) 16px 8px; background: color-mix(in srgb, var(--bg) 84%, transparent); backdrop-filter: blur(16px) saturate(1.4); }
.shell:has(.nav) { padding-top: 0; }
.nav .title { flex: 1; font-size: 1.1rem; font-weight: 750; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

input, textarea, select { font: inherit; color: var(--ink); background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px; width: 100%; }
textarea { resize: none; }
input:focus, textarea:focus, select:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
a { color: var(--accent); }
</style>
