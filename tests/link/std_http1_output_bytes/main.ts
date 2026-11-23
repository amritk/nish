// `Http1OutputPool` makes its buffers with no panic site: up to 65535 bytes
// in one `new Array` a `u16` length proves, and past that by pushes on one.
// Each size comes back whole and zeroed, a negative size is an empty buffer,
// and a buffer given back is the one taken next.
import { Http1OutputPool } from "nish/net/http1-server"
import { Suite } from "nish/testing"

/** Whether every byte of `buf` is 0. */
const zeroed = (buf: u8[]): boolean => {
  for (let i: i32 = 0; i < toI32(buf.length); i++) {
    if (buf[i] !== 0) {
      return false
    }
  }
  return true
}

export const main = (): i32 => {
  const t = new Suite("http1-output-bytes")
  const sizes: i32[] = [0, 1, 65535, 65536, 65537, 200000]
  for (let k: i32 = 0; k < toI32(sizes.length); k++) {
    const size: i32 = sizes[k]
    const buf: u8[] = new Http1OutputPool(size).take()
    t.eqI32(`a ${size}-byte buffer has ${size} bytes`, toI32(buf.length), size)
    t.ok(`a ${size}-byte buffer is zeroed`, zeroed(buf))
  }
  t.eqI32("a negative size is an empty buffer", toI32(new Http1OutputPool(-1).take().length), 0)
  const pool = new Http1OutputPool(70000)
  const first: u8[] = pool.take()
  first[69999] = 7
  pool.give(first)
  const again: u8[] = pool.take()
  t.ok("the buffer given back is taken next", again === first)
  t.eqI32("it keeps what it held", toI32(again[69999]), 7)
  t.eqI32("the pool made one", pool.made, 1)
  return t.done()
}
