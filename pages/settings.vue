<script setup lang="ts">
const store = useStore()
const s = computed(() => store.state.value.settings)
const msg = ref('')
const fileInput = ref<HTMLInputElement>()

function num(e: Event, key: 'seconds' | 'sessionSize' | 'dailyNew', min: number, max: number) {
  const v = Math.min(max, Math.max(min, Number((e.target as HTMLInputElement).value) || min))
  store.setSettings({ [key]: v })
}

function doExport() {
  const blob = new Blob([store.exportJson()], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `engs-progress-${dayKey()}.json`
  a.click()
  URL.revokeObjectURL(a.href)
}

async function doImport(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  try {
    store.importJson(await f.text())
    msg.value = 'Đã nhập tiến độ.'
  } catch {
    msg.value = 'File không hợp lệ.'
  }
}

function doReset() {
  if (confirm('Xóa toàn bộ tiến độ học?')) {
    store.reset()
    msg.value = 'Đã xóa tiến độ.'
  }
}
</script>

<template>
  <header class="row top">
    <NuxtLink to="/" class="btn ghost">←</NuxtLink>
    <h1>Cài đặt</h1>
  </header>

  <section class="card f">
    <label>Thời gian cho mỗi câu (giây)
      <input type="number" inputmode="numeric" :value="s.seconds" @change="num($event, 'seconds', 5, 120)" />
    </label>
    <label>Số câu mỗi lượt
      <input type="number" inputmode="numeric" :value="s.sessionSize" @change="num($event, 'sessionSize', 3, 50)" />
    </label>
    <label>Số câu mới tối đa mỗi lượt
      <input type="number" inputmode="numeric" :value="s.dailyNew" @change="num($event, 'dailyNew', 0, 100)" />
    </label>
    <label>Mã truy cập (nếu bạn đã đặt ACCESS_CODE trên server)
      <input type="password" :value="s.accessCode" autocomplete="off" @change="store.setSettings({ accessCode: ($event.target as HTMLInputElement).value })" />
    </label>
  </section>

  <section class="card f">
    <h2>Dữ liệu</h2>
    <div class="row wrap">
      <button class="btn" @click="doExport">Xuất tiến độ</button>
      <button class="btn" @click="fileInput?.click()">Nhập tiến độ</button>
      <button class="btn ghost" @click="doReset">Xóa tiến độ</button>
    </div>
    <input ref="fileInput" type="file" accept="application/json" hidden @change="doImport" />
    <p v-if="msg" class="muted">{{ msg }}</p>
    <p class="muted small">Tiến độ chỉ lưu trên máy này. Dùng "Xuất/Nhập" để chuyển sang thiết bị khác.</p>
  </section>
</template>

<style scoped>
.top { margin: 8px 0 16px; }
.f { margin-bottom: 14px; display: flex; flex-direction: column; gap: 14px; }
label { display: flex; flex-direction: column; gap: 6px; font-weight: 600; }
.small { font-size: .85rem; margin: 0; }
</style>
