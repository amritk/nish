// The guard shapes of `std/` callers a caller contract reads
// (docs/LANGUAGE.md, "Panic sites"), each at a call that proves it.
// `checkWindow` is `std/net/url.ts`'s `urlCheckWindow`: the length named
// once by `const size: i32 = toI32(bytes.length)`, then a window behind
// `off > size || len > size - off`. `readInto` is `std/net/fetch.ts`'s read
// guard, the window's sum widened to `i64`. `copy` is the guard a copy of
// one buffer's window into another's holds, both windows in `p >
// toI32(b.length) - q` form. `cell` is an index, `at >= toI32(xs.length)`.
// Every call into each is proven, so each one's `panic` is listed as proven
// (`expected.panics`). Each call takes a buffer of its own, since a call
// that takes a buffer forgets what its literal said of its length.
// `caller_contract_shapes_unproven` is each at a call nothing proves.
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

export const main = (): i32 => {
  const a: u8[] = [1, 2, 3, 4, 5, 6, 7, 8]
  console.log(`${checkWindow(a, 2, 4, "main")}`)
  const b: u8[] = [1, 2, 3, 4, 5, 6, 7, 8]
  console.log(`${checkWindow(b, 0, toI32(b.length), "main")}`)
  const c: u8[] = [1, 2, 3, 4, 5, 6, 7, 8]
  console.log(`${readInto(c, 0, toI32(c.length))}`)
  const d: u8[] = [1, 2, 3, 4, 5, 6, 7, 8]
  console.log(`${readInto(d, 4, 4)}`)
  const e: u8[] = [1, 2, 3, 4, 5, 6, 7, 8]
  const other: u8[] = [9, 9, 9, 9]
  console.log(`${copy(e, 4, other, 0, 4)}`)
  const f: u8[] = [1, 2, 3, 4, 5, 6, 7, 8]
  console.log(`${copy(f, 0, f, 0, toI32(f.length))}`)
  const xs: i32[] = [1, 2, 3]
  console.log(`${cell(xs, 2)}`)
  console.log(done())
  return 0
}
