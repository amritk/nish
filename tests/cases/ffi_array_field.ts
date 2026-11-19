// WP66 S4: a `declare class` field spelled `Record<integer<0, Hi>, T>` is C's
// `T name[Hi + 1]`, laid out inline at `T`'s alignment. `ffi_array_field.c`
// declares the same struct, shaped like OpenSSL's `SHA_CTX`: `h` is
// `uint32_t h[5]` after a `uint8_t`, so it starts at offset 4, and `data` is
// `uint8_t data[3]` between a `uint16_t` and a `double`, so padding follows
// it. C fills a zeroed instance (`readH` and `readData` read every element
// back), and C checks what the program wrote through the class (`written`,
// `poke`). An element the two sides placed differently comes back wrong.
// `readH(5)`, `readH(-1)` and `poke(3)` panic before they touch memory; the
// driver runs each in a child and prints its message and exit status.
declare class ShaCtx {
  tag: u8
  h: Record<integer<0, 4>, u32>
  total: u64
  num: u16
  data: Record<integer<0, 2>, u8>
  last: f64
}

declare function fillCtx(c: ShaCtx): void
declare function checkCtx(c: ShaCtx): i32

const filled = (): ShaCtx => {
  const c = new ShaCtx()
  fillCtx(c)
  return c
}

/** Element `i` of C's `h`: a dynamic index, checked against 5 at run time. */
export const readH = (i: i32): u32 => {
  return filled().h[i]
};

/** Element `i` of C's `data`, checked against 3. */
export const readData = (i: i32): u8 => {
  return filled().data[i]
};

/** Every element of `h`, by a loop index the prover keeps inside 0 to 4: no check is emitted. */
export const sumH = (): u32 => {
  const c = filled()
  let sum: u32 = 0
  for (let i = 0; i < 5; i++) {
    sum += c.h[i]
  }
  return sum
};

/**
 * Writes `data[i]` of the struct it is handed: a write through `c`, so `c`
 * is not `readonly`, and the caller's `checkCtx` sees the byte.
 */
const store = (c: ShaCtx, i: i32, v: u8): void => {
  c.data[i] = v
}

/** Writes `data[i]` by a dynamic index, checked against 3, and lets C check it. */
export const poke = (i: i32): i32 => {
  const c = new ShaCtx()
  store(c, i, 0xbb)
  return checkCtx(c)
};

/** The scalars around the arrays, which move if an array's size or alignment is wrong. */
export const readScalars = (): f64 => {
  const c = filled()
  return toF64(c.tag) + toF64(c.total) + toF64(c.num) + c.last
};

/** A fresh instance is all zeros, the arrays included. */
export const zeroed = (): i32 => {
  return checkCtx(new ShaCtx())
};

/** The program writes every element by constant index, then updates two in place. */
export const written = (): i32 => {
  const c = new ShaCtx()
  c.tag = 1
  c.h[0] = 0x67452301
  c.h[1] = 0xefcdab88
  c.h[2] = 0x98badcfe
  c.h[3] = 0x10325476
  c.h[4] = 0xc3d2e1f0
  c.h[1] += 1
  c.total = 64
  c.num = 7
  c.data[0] = 0xaa
  c.data[1] = 0xbb
  c.data[2] = 0x4c
  c.data[2] |= 0x80
  c.last = 0.5
  return checkCtx(c)
};
