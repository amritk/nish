// The Deflater bench of docs/wp48-ref32-classes.md §5.5: each round deflates
// one 4 KiB body with a `Deflater` made for it and zlib-wraps another with a
// `ZlibCompressor` reused across rounds, folding both lengths and last bytes
// into a checksum. A `ZlibCompressor` holds only a `Deflater` link (8 bytes,
// 4 narrowed; a `GzipCompressor` stays 16 either way) and the deflater is
// made in the loop, so the holder-only rule of #1736 picks `Deflater` here;
// the stage-3 rule leaves it alone.
//
//   build/nish tests/layout/compact-bench/zlib-each.ts --link build/cb-zlib && build/cb-zlib <rounds>
import { compressBound, Deflater } from "nish/compress/deflate"
import { ZlibCompressor } from "nish/compress/zlib"

const BODY_BYTES: i32 = 4096

export const main = (): number => {
  const rounds: i32 = process.argv.length > 1 ? toI32(parseInt(process.argv[1])) : 100
  const src = new Array<u8>(BODY_BYTES)
  const words: string = "the quick brown fox jumps over the lazy dog, then naps; "
  for (let i: i32 = 0; i < BODY_BYTES; i += 1) {
    src[i] = toU8(toI32(words.charCodeAt(i % toI32(words.length))))
  }
  const out = new Array<u8>(compressBound(BODY_BYTES) + 64)
  const z = new ZlibCompressor(6)
  let checksum: i64 = 0
  for (let i: i32 = 0; i < rounds; i += 1) {
    src[i % BODY_BYTES] = toU8(48 + (i % 10))
    const raw: i32 = new Deflater(6).compress(src, 0, BODY_BYTES, out, 0)
    if (raw <= 0) {
      console.error("no room")
      return 1
    }
    const rawLast: i64 = toI64(out[raw - 1])
    const end: i32 = z.compress(src, 0, BODY_BYTES, out, 0)
    if (end <= 0) {
      console.error("no room")
      return 1
    }
    checksum = (checksum * toI64(31) + toI64(raw) + rawLast + toI64(end) + toI64(out[end - 1])) % toI64(1000000007)
  }
  console.log(`${checksum}`)
  return 0
}
