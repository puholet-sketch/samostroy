/** Запуск: node docs/scripts/generate_preview_docs.mjs */
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const inner = join(root, 'docs/scripts/generate_preview_docs_inner.ts')
const out = join(root, 'docs/preview')

const r = spawnSync('npx', ['tsx', inner, out], {
  cwd: root,
  encoding: 'utf8',
  shell: true,
  stdio: 'inherit',
})
process.exit(r.status ?? 1)
