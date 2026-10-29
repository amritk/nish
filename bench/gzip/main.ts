// One-shot gzip of a JSON body, the feed API's hot path: compress `feed.json`
// (or the file named by argv[1]) into a reused buffer with a reused
// `GzipCompressor`, at level 1 and at level 6, and decompress with a reused
// `GzipDecompressor`: its own output, or with argv[3] and argv[4] the gzip -1
// and gzip -6 streams named there, which compare.mjs has every language
// decompress. Prints, per row, the input size, the compressed size, the
// nanoseconds and the calls; `run.mjs` and `compare/compare.mjs` read the
// lines.
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

/**
 * Times `calls` decompressions of the level-`level` stream, `given` or else
 * this compressor's own, and prints one row.
 */
const timeDecompress = (body: u8[], level: i32, calls: i32, given: u8[] | null): void => {
  const n: i32 = toI32(body.length)
  let out: u8[] = new Array<u8>(compressBound(n))
  let end: i32 = new GzipCompressor(level).compress(body, 0, n, out, 0)
  if (given !== null) {
    out = given
    end = toI32(given.length)
  }
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
  const gz1: u8[] | null = process.argv.length > 4 ? readFileBytesSync(process.argv[3]) : null
  const gz6: u8[] | null = process.argv.length > 4 ? readFileBytesSync(process.argv[4]) : null
  timeDecompress(body, 1, calls, gz1)
  timeDecompress(body, 6, calls, gz6)
  return 0
}
