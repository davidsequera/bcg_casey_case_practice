/** Minimal assertion harness shared by the test files. */
let failures = 0

export function check(name: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`  PASS ${name}`)
  } else {
    failures++
    console.log(`  FAIL ${name}${detail ? ' ' + detail : ''}`)
  }
}

export function section(name: string): void {
  console.log(`\n${name}`)
}

export function finish(): void {
  if (failures === 0) {
    console.log('\nAll checks passed.')
    process.exit(0)
  }
  console.log(`\n${failures} check(s) failed.`)
  process.exit(1)
}

/** Strips tags and unescapes the entities React emits, for text assertions. */
export function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}
