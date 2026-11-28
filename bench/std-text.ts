// Text helpers (std/text.ts) under an instruction count: about 1 MiB of
// generated lines, padded with spaces and tabs and ended by "\n" or "\r\n",
// split by `splitLines`, every line cut by `trim` and searched by
// `indexOfAny` for its separators, `n` times. It reaches the byte scans whose
// panic sites the std/ ratchet counts, so a fix to one of them shows here as a
// count that holds or falls. It prints the sum of the lengths and offsets it
// read.
import { indexOfAny, splitLines, trim } from "nish/text"

const LINES: i32 = 16000

const generate = (): string => {
  const parts: string[] = []
  for (let i: i32 = 0; i < LINES; i++) {
    const pad = i % 3 === 0 ? "  \t" : " "
    const end = i % 4 === 0 ? "\r\n" : "\n"
    parts.push(`${pad}key${i} = value ${i * 31}; note: line ${i} of the text${pad}${end}`)
  }
  return parts.join("")
}

export const main = (): i32 => {
  const n: i32 = 17 // bench:n
  const text = generate()
  let sum: i64 = 0
  for (let round: i32 = 0; round < n; round++) {
    const lines = splitLines(text)
    sum += toI64(lines.length)
    for (const line of lines) {
      const cut = trim(line)
      sum += toI64(cut.length)
      let at: i32 = indexOfAny(cut, "=;:", 0)
      while (at >= 0) {
        sum += toI64(at)
        at = indexOfAny(cut, "=;:", at + 1)
      }
    }
  }
  console.log(`${text.length} ${sum}`)
  return 0
}
