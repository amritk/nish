// Field extraction with `std/json`: the three fields a reader of the
// compiler's `--json` stream wants — `code` (a string near the front), `line`
// (a number) and `message` (the last field, after a nested object and an
// array, often with escapes) — out of every line of the input. The clock is
// read around that loop alone, so reading the file and splitting it into lines
// are not timed, in this program or in any of its twins. The checksum adds the byte length of each string and the value of each
// number, masked to 30 bits after every line so that it never overflows an
// `i32`; the twins in this directory compute the same one.
//
// It prints the checksum and then the loop's time in nanoseconds.
//
//   json <input.jsonl>
import { jsonField } from "nish/json"
import { splitLines } from "nish/text"

const MASK: i32 = 1073741823

export const main = (): number => {
  const text = readFileSync(process.argv[1])
  const lines = splitLines(text)
  const start = monotonicNanos()
  let sum: i32 = 0
  for (const line of lines) {
    if (toI32(line.length) === 0) {
      continue
    }
    const code = jsonField(line, "code")
    const at = jsonField(line, "line")
    const message = jsonField(line, "message")
    if (code === null || at === null || message === null) {
      panic("a field is missing")
    }
    sum = (sum + toI32(code.length) + toI32(parseInt(at)) + toI32(message.length)) & MASK
  }
  const elapsed = monotonicNanos() - start
  console.log(sum)
  console.log(elapsed)
  return 0
}
