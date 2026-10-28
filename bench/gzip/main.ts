// One-shot gzip of a JSON body, the feed API's hot path: compress `feed.json`
// (or the file named by argv[1]) into a reused buffer with a reused
// `GzipCompressor`, at level 1 and at level 6, and decompress it back with a
// reused `GzipDecompressor`. Prints, per row, the compressed size, the
// microseconds per call and the input MB/s; `run.mjs` reads the lines.
import { readFileBytesSync } from "nish:fs"
import { monotonicNanos } from "nish:process"
import { compressBound } from "nish/compress/deflate"
import { GzipCompressor, GzipDecompressor } from "nish/compress/gzip"

/** Times `calls` compressions at `level` and prints one row. */
const timeCompress = (body: u8[], level: i32, calls: i32): void => {
  const n: i32 = toI32(body.length)
  const gz = new GzipCompressor(level)
  const out: u8[] = new Array<u8>(compressBound(n))
  let end: i32 = 0
  for (let i: i32 = 0; i < 200; i++) {
    end = gz.compress(body, 0, n, out, 0)
  }
  const started: i64 = monotonicNanos()
  for (let i: i32 = 0; i < calls; i++) {
    end = gz.compress(body, 0, n, out, 0)
  }
  const ns: i64 = monotonicNanos() - started
  console.log(`nish gzip -${level} ${n} ${end} ${ns} ${calls}`)
}

/** Times `calls` decompressions of the level-`level` stream and prints one row. */
const timeDecompress = (body: u8[], level: i32, calls: i32): void => {
  const n: i32 = toI32(body.length)
  const out: u8[] = new Array<u8>(compressBound(n))
  const end: i32 = new GzipCompressor(level).compress(body, 0, n, out, 0)
  const back: u8[] = new Array<u8>(n)
  const gunzip = new GzipDecompressor()
  let got: i32 = 0
  const started: i64 = monotonicNanos()
  for (let i: i32 = 0; i < calls; i++) {
    got = gunzip.decompress(out, 0, end, back, 0, n)
  }
  const ns: i64 = monotonicNanos() - started
  if (got !== n) {
    panic(`gunzip answered ${got}`)
  }
  console.log(`nish gunzip -${level} ${n} ${end} ${ns} ${calls}`)
}

export const main = (): number => {
  const path: string = process.argv.length > 1 ? process.argv[1] : "bench/gzip/feed.json"
  const read: u8[] | null = readFileBytesSync(path)
  if (read === null) {
    console.log(`cannot read ${path}`)
    return 1
  }
  const body: u8[] = read
  const calls: i32 = process.argv.length > 2 ? parseInt(process.argv[2]) : 20000
  timeCompress(body, 1, calls)
  timeCompress(body, 6, calls)
  timeDecompress(body, 1, calls)
  timeDecompress(body, 6, calls)
  return 0
}
