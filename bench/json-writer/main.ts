// WP34 N11: `JsonWriter` writing the TechEmpower `/json` body,
// `{"message":"…"}`, into one reused buffer, `count` times (default
// 2,000,000; `process.argv[1]` overrides it). `bench/json-writer/run.mjs`
// builds and times it; this prints the checksum and the loop's own time.
//
// The message is one of 64 built before the clock starts, picked by the
// iteration, so no two neighbouring writes are the same and none of them
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
  const out = new Array<u8>(128)
  const w = new JsonWriter(out, 0)
  let sum: u32 = 0
  const factor: u32 = 31
  const t0: i64 = monotonicNanos()
  for (let i: i32 = 0; i < count; i += 1) {
    const pick: i32 = i % 64
    w.reset(out, 0)
    w.beginObject()
    w.key("message")
    w.string(pick < toI32(messages.length) ? messages[pick] : "")
    w.endObject()
    const end: i32 = w.end
    for (let k: i32 = 0; k < end && k < toI32(out.length); k += 1) {
      sum = sum * factor + toU32(out[k])
    }
  }
  const elapsed: i64 = monotonicNanos() - t0
  console.log(`checksum ${sum} failed ${w.failed} count ${count} ns ${elapsed}`)
  return 0
}
