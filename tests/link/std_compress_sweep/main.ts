// Truncates every stream of raw deflate, zlib and gzip (four payloads, levels
// 0, 1, 6 and 9: 48 streams) at each length, and flips bits through each one
// (every byte for a stream of up to 200 bytes, a third of the byte-and-mask
// pairs above that), and decodes each of the 53,552 inputs. The counts pin
// that no truncated stream is accepted, that no corrupted zlib or gzip stream
// decodes to other bytes, and that a limit one byte short answers -8. The
// hash folds every return code in order, so a decoder that answers any input
// differently changes it; 778857 is what base b5e2b3a4 printed, before
// deflate's sums were checked (COMP-21 in docs/security/compress.md). A raw
// stream carries no checksum, so a corrupted one may decode to other bytes:
// it is counted, not refused.
import { deflateCompress, deflateDecompress, compressBound } from "nish/compress/deflate"
import { zlibCompress, zlibDecompress } from "nish/compress/zlib"
import { gzipCompress, gzipDecompress } from "nish/compress/gzip"

const payload = (kind: i32, n: i32): u8[] => {
  const p: u8[] = new Array<u8>(n)
  let s: i32 = 12345 + kind
  const text: string = "the quick brown fox jumps over the lazy dog; "
  for (let i: i32 = 0; i < n; i += 1) {
    s = (s * 1103 + 12345) % 65536
    if (kind === 0) {
      p[i] = toU8(text.charCodeAt(i % text.length))
    } else if (kind === 1) {
      p[i] = toU8((s >> 5) & 255)
    } else if (kind === 2) {
      p[i] = toU8((i / 300) & 3)
    } else {
      p[i] = i % 700 < 350 ? toU8((s >> 9) & 7) : p[i - 350]
    }
  }
  return p
}

const enc = (fmt: i32, src: u8[], level: i32, out: u8[]): i32 => {
  const n: i32 = toI32(src.length)
  if (fmt === 0) return deflateCompress(src, 0, n, out, 0, level)
  if (fmt === 1) return zlibCompress(src, 0, n, out, 0, level)
  return gzipCompress(src, 0, n, out, 0, level)
}
const dec = (fmt: i32, src: u8[], len: i32, out: u8[], limit: i32): i32 => {
  if (fmt === 0) return deflateDecompress(src, 0, len, out, 0, limit)
  if (fmt === 1) return zlibDecompress(src, 0, len, out, 0, limit)
  return gzipDecompress(src, 0, len, out, 0, limit)
}
const same = (a: u8[], b: u8[], n: i32): boolean => {
  if (n !== toI32(b.length)) return false
  for (let i: i32 = 0; i < n; i += 1) {
    if (a[i] !== b[i]) return false
  }
  return true
}

let streams: i32 = 0
let h: i32 = 0
let inputs: i32 = 0
let refused: i32 = 0
let exact: i32 = 0
let differs: i32 = 0
let wrong: i32 = 0
let truncAccepted: i32 = 0
let limitOk: i32 = 0
const sizes: i32[] = [700, 400, 2400, 1400]
const levels: i32[] = [0, 1, 6, 9]
for (let fmt: i32 = 0; fmt < 3; fmt += 1) {
  const i0: i32 = inputs
  const r0: i32 = refused
  const e0: i32 = exact
  const d0: i32 = differs
  const w0: i32 = wrong
  for (let k: i32 = 0; k < 4; k += 1) {
    const src: u8[] = payload(k, sizes[k])
    const n: i32 = toI32(src.length)
    for (let li: i32 = 0; li < 4; li += 1) {
      const z: u8[] = new Array<u8>(compressBound(n) + 32)
      const zl: i32 = enc(fmt, src, levels[li], z)
      const limit: i32 = n * 2 + 64
      const out: u8[] = new Array<u8>(limit)
      streams += 1
      const whole: i32 = dec(fmt, z, zl, out, limit)
      if (!same(out, src, whole)) {
        console.log(`round trip failed fmt ${fmt} kind ${k} level ${levels[li]}: ${whole}`)
      }
      if (dec(fmt, z, zl, out, n - 1) === -8) limitOk += 1
      for (let t: i32 = 0; t < zl; t += 1) {
        inputs += 1
        const r: i32 = dec(fmt, z, t, out, limit)
        h = (h * 31 + r + 100) % 1000003
        if (r >= 0) truncAccepted += 1
        else refused += 1
      }
      const masks: i32[] = [1, 16, 128, 255]
      for (let i: i32 = 0; i < zl; i += 1) {
        for (let m: i32 = 0; m < 4; m += 1) {
          if ((i * 4 + m) % 3 !== 0 && zl > 200) continue
          const c: u8[] = new Array<u8>(zl)
          for (let j: i32 = 0; j < zl; j += 1) c[j] = z[j]
          c[i] = toU8(toI32(c[i]) ^ masks[m])
          inputs += 1
          const r: i32 = dec(fmt, c, zl, out, limit)
          h = (h * 31 + r + 100) % 1000003
          if (r < 0) refused += 1
          else if (same(out, src, r)) exact += 1
          else if (fmt === 0) differs += 1
          else wrong += 1
        }
      }
    }
  }
  console.log(`fmt ${fmt}: inputs ${inputs - i0} refused ${refused - r0} exact ${exact - e0} raw-differs ${differs - d0} wrong ${wrong - w0}`)
}
console.log(`streams ${streams} inputs ${inputs} refused ${refused} exact ${exact} raw-differs ${differs} wrong ${wrong} truncated-accepted ${truncAccepted} limit-refused ${limitOk}/${streams} hash ${h}`)
