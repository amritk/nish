// Small JSON bodies, the HTTP response case: each file named on the command
// line gzipped by a reused `GzipCompressor` at `DEFLATE_FAST` (dynamic
// Huffman, 32 KB window) and by a reused `GzipFixedCompressor` (fixed
// Huffman, 16 KB window, no state between calls), every output checked to
// gunzip back to its input. Prints one row per file and encoder: the input
// size, the compressed size, the nanoseconds and the calls; `small.mjs`
// reads the lines.
import { readFileBytesSync } from "nish:fs"
import { monotonicNanos } from "nish:process"
import { DEFLATE_FAST, compressBound } from "nish/compress/deflate"
import { GzipCompressor, GzipDecompressor, GzipFixedCompressor, gzipFixedBound } from "nish/compress/gzip"

/** Panics unless `out[0 .. end)` gunzips to `body`. */
const check = (gunzip: GzipDecompressor, body: u8[], out: u8[], end: i32, what: string): void => {
  const n: i32 = toI32(body.length)
  const back: u8[] = new Array<u8>(n + 1)
  const got: i32 = gunzip.decompress(out, 0, end, back, 0, n + 1)
  if (got !== n) {
    panic(`${what}: gunzip answered ${got} for ${n} bytes`)
  }
  for (let i: i32 = 0; i < n; i++) {
    if (back[i] !== body[i]) {
      panic(`${what}: byte ${i} differs after the round trip`)
    }
  }
}

export const main = (): number => {
  const calls: i32 = parseInt(process.argv[1])
  const fast = new GzipCompressor(DEFLATE_FAST)
  const fixed = new GzipFixedCompressor()
  const gunzip = new GzipDecompressor()
  for (let f: i32 = 2; f < process.argv.length; f++) {
    const read: u8[] | null = readFileBytesSync(process.argv[f])
    if (read === null) {
      console.log(`cannot read ${process.argv[f]}`)
      return 1
    }
    const body: u8[] = read
    const n: i32 = toI32(body.length)
    const out: u8[] = new Array<u8>(compressBound(n) + gzipFixedBound(n))
    let end: i32 = 0
    for (let i: i32 = 0; i < 200; i++) {
      end = fast.compress(body, 0, n, out, 0)
    }
    let started: i64 = monotonicNanos()
    for (let i: i32 = 0; i < calls; i++) {
      end = fast.compress(body, 0, n, out, 0)
    }
    let ns: i64 = monotonicNanos() - started
    check(gunzip, body, out, end, "fast")
    console.log(`fast ${n} ${end} ${ns} ${calls}`)
    const room: i32 = toI32(out.length)
    for (let i: i32 = 0; i < 200; i++) {
      end = fixed.compress(body, 0, n, out, 0, room)
    }
    started = monotonicNanos()
    for (let i: i32 = 0; i < calls; i++) {
      end = fixed.compress(body, 0, n, out, 0, room)
    }
    ns = monotonicNanos() - started
    check(gunzip, body, out, end, "fixed")
    console.log(`fixed ${n} ${end} ${ns} ${calls}`)
  }
  return 0
}
