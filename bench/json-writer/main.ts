// WP34 N11: `JsonWriter` writing the TechEmpower `/json` body,
// `{"message":"…"}`, into one reused buffer, `count` times (default
// 2,000,000; `process.argv[1]` overrides it), minified or, with `pretty` as
// `process.argv[2]`, indented by two spaces. `bench/json-writer/run.mjs`
// builds and times it; this prints the checksum and the loop's own time.
//
// The message is one of 64 built before the clock starts, picked by the
// iteration (and the doubles eight of 64, of every spelling's shape: integral,
// short and 17-digit fractions, exponents both ways, negatives), so no two neighbouring writes are the same and none of them
// allocates; every byte each write leaves is folded into the checksum, so the
// optimiser cannot drop a write nor compute the loop once. The fold is inside
// the timed loop, and the ns/op it prints is a write and a fold.
import { JsonWriter } from "nish/json"

export const main = (): number => {
  const count: i32 = toI32(process.argv.length) > 1 ? toI32(parseInt(process.argv[1])) : 2000000
  const messages: string[] = []
  for (let k: i32 = 0; k < 64; k += 1) {
    messages.push(`Hello, World! ${k}`)
  }
  const numbers: f64[] = []
  for (let k: i32 = 0; k < 64; k += 1) {
    const x: f64 = toF64(k)
    const shape: i32 = k % 8
    const sign: f64 = k % 3 === 0 ? -1.0 : 1.0
    if (shape === 0) {
      numbers.push(sign * x * 1000.0)
    } else if (shape === 1) {
      numbers.push(sign * (x + 0.5))
    } else if (shape === 2) {
      numbers.push((sign * (x + 1.0)) / 3.0)
    } else if (shape === 3) {
      numbers.push(sign * (x + 1.0) * 1.0e21)
    } else if (shape === 4) {
      numbers.push(sign * (x + 1.0) * 1.0e-9)
    } else if (shape === 5) {
      numbers.push(sign * Math.sqrt(x + 2.0))
    } else if (shape === 6) {
      numbers.push(sign * (x + 1.0) * 1.0e300)
    } else {
      numbers.push(sign * (x + 1.0) * 0.1)
    }
  }
  const mode: string = toI32(process.argv.length) > 2 ? process.argv[2] : ""
  const out = new Array<u8>(256)
  const w = new JsonWriter(out, 0)
  if (mode === "pretty") {
    w.setIndent(2)
  }
  let sum: u32 = 0
  const factor: u32 = 31
  const t0: i64 = monotonicNanos()
  for (let i: i32 = 0; i < count; i += 1) {
    const pick: i32 = i % 64
    w.reset(out, 0)
    if (mode === "f64") {
      w.beginArray()
      for (let j: i32 = 0; j < 8; j += 1) {
        const at: i32 = (pick + j * 9) % 64
        w.f64(at < toI32(numbers.length) ? numbers[at] : toF64(0))
      }
      w.endArray()
    } else {
      w.beginObject()
      w.key("message")
      w.string(pick < toI32(messages.length) ? messages[pick] : "")
      w.endObject()
    }
    const end: i32 = w.end
    for (let k: i32 = 0; k < end && k < toI32(out.length); k += 1) {
      sum = sum * factor + toU32(out[k])
    }
  }
  const elapsed: i64 = monotonicNanos() - t0
  console.log(`checksum ${sum} failed ${w.failed} count ${count} ns ${elapsed}`)
  return 0
}
