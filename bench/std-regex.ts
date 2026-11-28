// Regular expressions (std/regex.ts) under an instruction count: two patterns
// compiled by `regexCompile` `n` times, one with a literal prefix the matcher
// can scan for and one that starts with a class it cannot, each run by `test`
// on every line of a generated log and by `findAll` over the whole of it. It
// reaches the compiler, the prefix scan and the backtracking matcher whose
// panic sites the std/ ratchet counts, so a fix to one of them shows here as a
// count that holds or falls. It prints the sum of the matches it found.
import { Regex, regexCompile } from "nish/regex"

const LINES: i32 = 2000

const generate = (): string[] => {
  const lines: string[] = []
  for (let i: i32 = 0; i < LINES; i++) {
    const level = i % 5 === 0 ? "ERROR" : "INFO"
    lines.push(`2026-11-${10 + (i % 18)} ${level} worker${i % 13} handled request id=${i * 7919} in ${i % 97}ms`)
  }
  return lines
}

/** `pattern` compiled with `flags`, or null after printing why it was refused. */
const compile = (pattern: string, flags: string): Regex | null => {
  const compiled = regexCompile(pattern, flags)
  if (compiled.isErr()) {
    console.error(compiled.error)
    return null
  }
  return compiled.value
}

export const main = (): i32 => {
  const n: i32 = 30 // bench:n
  const lines = generate()
  const text = lines.join("\n")
  let sum: i64 = 0
  for (let round: i32 = 0; round < n; round++) {
    // A literal prefix: "ERROR" starts every match.
    const prefixed = compile("ERROR worker(\\d+) handled request id=(\\d+)", "")
    // No literal prefix: a class starts every match.
    const open = compile("[a-z]+\\d+ handled [a-z]+ id=\\d{3,}", "")
    if (prefixed === null || open === null) {
      return 1
    }
    for (const line of lines) {
      if (prefixed.test(line)) {
        sum += 1
      }
      if (open.test(line)) {
        sum += 2
      }
    }
    sum += toI64(prefixed.findAll(text).length) + toI64(open.findAll(text).length)
  }
  console.log(`${sum}`)
  return 0
}
