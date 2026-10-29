<template>
  <div class="shell">
    <NuxtPage />
  </div>
</template>

<style>
:root {
  --bg: #fdf3e7;
  --card: #fffaf4;
  --ink: #2d2118;
  --muted: #8a7664;
  --line: #ecd9c3;
  --accent: #f08a3c;
  --accent-ink: #fff;
  --soft: #fbe3c8;
  --good: #2e9b5f;
  --good-bg: #dff3e6;
  --bad: #d4493b;
  --bad-bg: #fbe0dc;
  --warn: #b7791f;
  --warn-bg: #fdf0cf;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1b1612;
    --card: #261f19;
    --ink: #f4ebe1;
    --muted: #a8998a;
    --line: #3a3027;
    --soft: #3a2a1c;
    --good-bg: #17331f;
    --bad-bg: #3a1c18;
    --warn-bg: #3a2f14;
    --good: #5fd08c;
    --bad: #ff8577;
    --warn: #f0c060;
  }
}
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
html, body { margin: 0; background: var(--bg); color: var(--ink); }
body { font: 16px/1.5 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
.shell { max-width: 560px; margin: 0 auto; padding: max(16px, env(safe-area-inset-top)) 16px max(24px, env(safe-area-inset-bottom)); min-height: 100dvh; }
h1 { font-size: 1.5rem; margin: 0; }
h2 { font-size: 1.05rem; margin: 0 0 8px; }
.muted { color: var(--muted); }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 20px; padding: 18px; }
.btn { appearance: none; border: 0; border-radius: 14px; padding: 12px 18px; font: inherit; font-weight: 600; cursor: pointer; background: var(--soft); color: var(--ink); min-height: 46px; }
.btn:disabled { opacity: .5; cursor: default; }
.btn.primary { background: var(--accent); color: var(--accent-ink); }
.btn.block { width: 100%; }
.btn.ghost { background: transparent; border: 1px solid var(--line); }
.row { display: flex; gap: 10px; align-items: center; }
.wrap { flex-wrap: wrap; }
.grow { flex: 1; }
.chip { appearance: none; border: 1px solid var(--line); background: var(--card); color: var(--ink); border-radius: 999px; padding: 8px 14px; font: inherit; cursor: pointer; min-height: 40px; }
.chip.on { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); font-weight: 600; }
input, textarea { font: inherit; color: var(--ink); background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 12px; width: 100%; }
textarea { resize: none; }
input:focus, textarea:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
a { color: var(--accent); }
</style>
