// Deploy thủ công lên Cloudflare Pages: build sạch, kiểm tra bản build không lẫn file dev, rồi mới upload.
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

const PROJECT = 'engs-training'
const BRANCH = 'main'

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true })
  if (r.status !== 0) {
    console.error(`\n✖ "${cmd} ${args.join(' ')}" failed (exit ${r.status}). Nothing was deployed.`)
    process.exit(r.status ?? 1)
  }
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) yield* walk(p)
    else yield p
  }
}

// Dấu hiệu của bản dev: client Vite dev, hoặc đường dẫn tuyệt đối của ổ đĩa trỏ vào node_modules.
const DEV_MARKERS = [/@vite\/client/, /[A-Za-z]:[\\/][^"'\s]*node_modules/]

function verify() {
  const bad = []
  for (const file of walk('dist')) {
    if (!/\.(m?js|html|json)$/.test(file)) continue
    const text = readFileSync(file, 'utf8')
    for (const re of DEV_MARKERS) if (re.test(text)) bad.push(`${file}  (${re})`)
  }
  if (bad.length) {
    console.error('\n✖ The build contains development-mode files, so it would show a blank page:')
    for (const b of bad.slice(0, 10)) console.error('  - ' + b)
    console.error('\nStop any running `nuxt dev`, delete the .nuxt and dist folders, and try again. Nothing was deployed.')
    process.exit(1)
  }
  console.log('✔ Build looks like a production build.')
}

for (const dir of ['dist', '.nuxt-build']) rmSync(dir, { recursive: true, force: true })
run('npx', ['nuxt', 'build'])
verify()
run('npx', ['wrangler@4', 'pages', 'deploy', 'dist', '--project-name', PROJECT, '--branch', BRANCH])
