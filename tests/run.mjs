import { execFileSync } from 'node:child_process'
import { readdirSync, rmSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '.build')
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

const files = readdirSync(here)
  .filter((f) => /\.test\.tsx?$/.test(f))
  .sort()
let failed = 0

for (const file of files) {
  const bundle = join(out, file.replace(/\.tsx?$/, '.cjs'))
  console.log(`\n=== ${file} ===`)

  execFileSync(
    'npx',
    [
      'esbuild',
      join(here, file),
      '--bundle',
      '--platform=node',
      '--format=cjs',
      '--loader:.json=json',
      '--loader:.css=empty',
      '--loader:.md=text',
      '--jsx=automatic',
      '--external:jsdom',
      `--outfile=${bundle}`,
      '--log-level=error',
    ],
    { stdio: 'inherit', shell: process.platform === 'win32' },
  )

  try {
    process.stdout.write(execFileSync(process.execPath, [bundle], { encoding: 'utf8' }))
  } catch (e) {
    if (e.stdout) process.stdout.write(e.stdout)
    if (e.stderr) process.stderr.write(e.stderr)
    failed++
  }
}

rmSync(out, { recursive: true, force: true })
console.log(failed === 0 ? '\nAll test files passed.' : `\n${failed} test file(s) failed.`)
process.exit(failed === 0 ? 0 : 1)
