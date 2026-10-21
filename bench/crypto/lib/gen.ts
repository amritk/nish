// The crypto twins' shared input generator and checksum fold, in Nish: one
// half of the program contract bench/crypto/README.md states, and the same
// bytes gen.c, gen.go, gen.rs and gen.mjs produce. A family's main.ts imports
// it as "../lib/gen".
//
//   seed     FNV-1a 32 over the bytes of `<kernel>:<size>`, 0 read as 1
//   stream   xorshift32 (13, 17, 5), one step a byte, the low byte kept
//   order    key, then nonce, then AAD, then message, from one stream
//   tweak    iteration i XORs i (u32, little-endian) into four bytes
//   fold     FNV-1a 32 over every output byte, in order
import { monotonicNanos } from "nish:process"

/** FNV-1a 32's offset basis, 2166136261: the fold's start. */
export const foldStart = (): u32 => 2166136261

/** One byte into FNV-1a 32: xor, then multiply by its prime, which wraps. */
const step = (h: u32, b: u8): u32 => (h ^ toU32(b)) * 16777619

/** One kernel's inputs, every buffer drawn from one stream in this order. */
export class Inputs {
  key: u8[]
  nonce: u8[]
  aad: u8[]
  msg: u8[]
  constructor(key: u8[], nonce: u8[], aad: u8[], msg: u8[]) {
    this.key = key
    this.nonce = nonce
    this.aad = aad
    this.msg = msg
  }
}

/** The command line every program takes: `<kernel> <size> <iterations>`. */
export class Args {
  kernel: string = ""
  size: i32 = 0
  iterations: i32 = 0
}

/** The xorshift32 state, carried from one buffer to the next. */
class Stream {
  x: u32 = 1
}

/** `<kernel>:<size>` hashed: the stream's seed. */
const seedOf = (kernel: string, size: i32): u32 => {
  const name: string = `${kernel}:${size}`
  let h: u32 = foldStart()
  for (let i: i32 = 0; i < toI32(name.length); i++) {
    h = step(h, toU8(name.charCodeAt(i)))
  }
  return h === 0 ? 1 : h
}

/** `length` bytes from `s`, one xorshift32 step a byte. */
const draw = (s: Stream, length: i32): u8[] => {
  const out: u8[] = new Array<u8>(length)
  let x: u32 = s.x
  for (let i: i32 = 0; i < toI32(out.length); i++) {
    x = x ^ (x << 13)
    x = x ^ (x >>> 17)
    x = x ^ (x << 5)
    out[i] = toU8(x & 255)
  }
  s.x = x
  return out
}

/** The key, nonce, AAD and message of `kernel` at `size`, at the lengths given. */
export const inputs = (
  kernel: string,
  size: i32,
  keyLen: i32,
  nonceLen: i32,
  aadLen: i32,
  msgLen: i32
): Inputs => {
  const s = new Stream()
  s.x = seedOf(kernel, size)
  const key: u8[] = draw(s, keyLen)
  const nonce: u8[] = draw(s, nonceLen)
  const aad: u8[] = draw(s, aadLen)
  return new Inputs(key, nonce, aad, draw(s, msgLen))
}

/** The four bytes at `bytes[at..at + 4)`, kept so `tweak` can XOR against the original. */
export const baseOf = (bytes: u8[], at: i32): u8[] => {
  const out: u8[] = new Array<u8>(4)
  for (let k: i32 = 0; k < 4; k++) {
    if (at + k >= 0 && at + k < toI32(bytes.length)) {
      out[k] = bytes[at + k]
    }
  }
  return out
}

/** Iteration `i`'s input: `bytes[at..at + 4)` set to `base` XOR `i`, little-endian. */
export const tweak = (bytes: u8[], at: i32, base: u8[], i: i32): void => {
  if (at < 0 || at + 4 > toI32(bytes.length) || base.length < 4) {
    return
  }
  bytes[at] = base[0] ^ toU8(i & 255)
  bytes[at + 1] = base[1] ^ toU8((i >> 8) & 255)
  bytes[at + 2] = base[2] ^ toU8((i >> 16) & 255)
  bytes[at + 3] = base[3] ^ toU8((i >> 24) & 255)
}

/** Every byte of `bytes` folded into `sum`, in order. */
export const fold = (sum: u32, bytes: u8[]): u32 => {
  let h: u32 = sum
  for (let i: i32 = 0; i < toI32(bytes.length); i++) {
    h = step(h, bytes[i])
  }
  return h
}

/** `n` as eight lowercase hex digits. */
const hex8 = (n: u32): string => {
  const digits: string = "0123456789abcdef"
  const out: string[] = []
  for (let k: i32 = 0; k < 8; k++) {
    out.push(String.fromCharCode(digits.charCodeAt(toI32((n >>> toU32(28 - k * 4)) & 15))))
  }
  return out.join("")
}

/** The command line, or null after a usage line on stderr. */
export const parseArgs = (program: string): Args | null => {
  if (process.argv.length !== 4) {
    writeError(`usage: ${program} <kernel> <size> <iterations>\n`)
    return null
  }
  const a = new Args()
  a.kernel = process.argv[1]
  a.size = parseInt(process.argv[2])
  a.iterations = parseInt(process.argv[3])
  if (a.size < 0 || a.iterations < 1) {
    writeError(`${program}: the size is a count of bytes and the iterations a positive count\n`)
    return null
  }
  return a
}

/** The clock the timed loop reads: monotonic nanoseconds. */
export const now = (): i64 => monotonicNanos()

/** The contract's two lines: the checksum on stdout, the timed loop's nanoseconds on stderr. */
export const report = (sum: u32, started: i64): void => {
  const ns: i64 = monotonicNanos() - started
  console.log(`checksum ${hex8(sum)}`)
  writeError(`ns ${ns}\n`)
}
