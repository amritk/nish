// One-shot block compression of a body: `nish/compress/lzav` against raw
// DEFLATE at level 1 from `nish/compress/deflate`, both with a reused
// compressor and buffers, each way. Prints, per row, the library, the
// operation, the input size, the compressed size, the nanoseconds and the
// calls; `run.mjs` reads the lines and builds `lzav.c`, the C twin, beside it.
import { readFileBytesSync } from "nish:fs"
import { monotonicNanos } from "nish:process"
import { DEFLATE_FAST, Deflater, Inflater, deflateBound } from "nish/compress/deflate"
import { LzavCompressor, lzavBound, lzavDecompress } from "nish/compress/lzav"

/** Times `calls` LZAV compressions and decompressions and prints two rows. */
const timeLzav = (body: u8[], calls: i32): void => {
  const n: i32 = toI32(body.length)
  const lzav = new LzavCompressor()
  const out: u8[] = new Array<u8>(lzavBound(n))
  let end: i32 = 0
  for (let i: i32 = 0; i < 20; i++) {
    end = lzav.compress(body, 0, n, out, 0)
  }
  let started: i64 = monotonicNanos()
  for (let i: i32 = 0; i < calls; i++) {
    end = lzav.compress(body, 0, n, out, 0)
  }
  let ns: i64 = monotonicNanos() - started
  console.log(`nish lzav compress ${n} ${end} ${ns} ${calls}`)
  const back: u8[] = new Array<u8>(n)
  let got: i32 = 0
  started = monotonicNanos()
  for (let i: i32 = 0; i < calls; i++) {
    got = lzavDecompress(out, 0, end, back, 0, n)
  }
  ns = monotonicNanos() - started
  if (got !== n) {
    panic(`lzavDecompress answered ${got}`)
  }
  console.log(`nish lzav decompress ${n} ${end} ${ns} ${calls}`)
}

/** Times `calls` raw DEFLATE level-1 compressions and decompressions and prints two rows. */
const timeDeflate = (body: u8[], calls: i32): void => {
  const n: i32 = toI32(body.length)
  const deflater = new Deflater(DEFLATE_FAST)
  const out: u8[] = new Array<u8>(deflateBound(n))
  let end: i32 = 0
  for (let i: i32 = 0; i < 20; i++) {
    end = deflater.compress(body, 0, n, out, 0)
  }
  let started: i64 = monotonicNanos()
  for (let i: i32 = 0; i < calls; i++) {
    end = deflater.compress(body, 0, n, out, 0)
  }
  let ns: i64 = monotonicNanos() - started
  console.log(`nish deflate-1 compress ${n} ${end} ${ns} ${calls}`)
  const back: u8[] = new Array<u8>(n)
  const inflater = new Inflater()
  let got: i32 = 0
  started = monotonicNanos()
  for (let i: i32 = 0; i < calls; i++) {
    got = inflater.decompress(out, 0, end, back, 0, n)
  }
  ns = monotonicNanos() - started
  if (got !== n) {
    panic(`Inflater.decompress answered ${got}`)
  }
  console.log(`nish deflate-1 decompress ${n} ${end} ${ns} ${calls}`)
}

export const main = (): number => {
  const path: string = process.argv.length > 1 ? process.argv[1] : "bench/gzip/feed.json"
  const read: u8[] | null = readFileBytesSync(path)
  if (read === null) {
    console.log(`cannot read ${path}`)
    return 1
  }
  const calls: i32 = process.argv.length > 2 ? parseInt(process.argv[2]) : 20000
  timeLzav(read, calls)
  timeDeflate(read, calls)
  return 0
}
