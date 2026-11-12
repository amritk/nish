// WP27 S4.1: a `declare class` has C's layout -- declaration order, each field
// at its natural alignment, a nested `declare class` embedded by value, the
// size rounded up to the widest alignment. `ffi_struct_layout.c` declares the
// same two structs. C fills a zeroed instance through the pointer it is lent
// (`readField` reads every field back), and C checks the fields the program
// wrote (`writtenFields`). Any field the two sides placed differently comes
// back wrong. `Mixed` has padding after `a`, `c`'s gap before `d`, `e`, and
// trailing padding after `z`; `Inner` has padding after `tag`.
declare class Inner {
  tag: u16
  link: CPtr | null
}

declare class Mixed {
  a: u8
  b: u64
  c: i32
  d: f64
  e: u16
  p: CPtr
  inner: Inner
  z: u8
}

declare function fillMixed(m: Mixed): void
declare function checkMixed(m: Mixed): i32
declare function isSentinel(p: CPtr): i32

const filled = (): Mixed => {
  const m = new Mixed()
  fillMixed(m)
  return m
}

export function readA(): u8 {
  return filled().a
}

export function readB(): u64 {
  return filled().b
}

export function readC(): i32 {
  return filled().c
}

export function readD(): f64 {
  return filled().d
}

export function readE(): u16 {
  return filled().e
}

export function readTag(): u16 {
  return filled().inner.tag
}

export function readZ(): u8 {
  return filled().z
}

/** 1 when C's `p` is its sentinel, plus 2 when the nested `link` it set is null. */
export function readPointers(): i32 {
  const m = filled()
  const link = m.inner.link
  return isSentinel(m.p) + (link === null ? 2 : 0)
}

/** A fresh instance is all zeros: C sees 0 in every field before the program writes. */
export function zeroFields(): i32 {
  return checkMixed(new Mixed())
}

/** The program writes every number field, and C reports which ones it found; `p` and `link` stay null. */
export function writtenFields(): i32 {
  const m = new Mixed()
  m.a = 200
  m.b = (toU64(0x01020304) << 32) | 0x05060708
  m.c = -5
  m.d = 2.5
  m.e = 65535
  m.inner.tag = 0xbeef
  m.z = 9
  return checkMixed(m)
}
