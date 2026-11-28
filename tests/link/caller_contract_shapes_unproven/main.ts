// The guard shapes `caller_contract_shapes` proves, each at a call nothing
// proves (docs/LANGUAGE.md, "Panic sites"): every wrapper below passes an
// offset or a count its own caller chooses, so the window may fall outside
// its buffer, and each callee's `panic` stays a site `--deny-panics`
// refuses, the first in `expected.err` and all four in `expected.json`.
import { done } from "./done"


const checkWindow = (bytes: u8[], off: i32, len: i32, who: string): i32 => {
  const size: i32 = toI32(bytes.length)
  if (off < 0 || len < 0 || off > size || len > size - off) {
    panic(`${who}: the window is outside the bytes`)
  }
  return len
}

const readInto = (buf: u8[], off: i32, n: i32): i32 => {
  if (off < 0 || n < 0 || toI64(off) + toI64(n) > toI64(buf.length)) {
    panic("readInto: the window is outside the buffer")
  }
  return n
}

const copy = (dst: u8[], at: i32, src: readonly u8[], from: i32, count: i32): i32 => {
  if (at < 0 || from < 0 || count < 0 || count > toI32(dst.length) - at || count > toI32(src.length) - from) {
    panic("copy: a window is outside its buffer")
  }
  return count
}

const cell = (xs: i32[], at: i32): i32 => {
  if (at < 0 || at >= toI32(xs.length)) {
    panic("cell: the index is outside the array")
  }
  return at
}

const window = (k: i32): i32 => {
  const a: u8[] = [1, 2, 3, 4]
  return checkWindow(a, k, 1, "window")
}

const read = (k: i32): i32 => {
  const a: u8[] = [1, 2, 3, 4]
  return readInto(a, 0, k)
}

const move = (k: i32): i32 => {
  const a: u8[] = [1, 2, 3, 4]
  const b: u8[] = [5, 6]
  return copy(a, 0, b, 0, k)
}

const at = (k: i32): i32 => {
  const xs: i32[] = [1, 2, 3]
  return cell(xs, k)
}

export const main = (): i32 => {
  console.log(`${window(1) + read(2) + move(2) + at(1)}`)
  console.log(done())
  return 0
}
