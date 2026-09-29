// WP34 N2: `set` between two fresh `const` arrays is a `memcpy`; through a
// parameter it is a `memmove`. `fill` on a `u8[]` is a `memset`.
export const copyInto = (dst: u8[], src: u8[], at: number): void => {
  dst.set(src, at)
}

export const packet = (): u8[] => {
  const out: u8[] = [0, 0, 0, 0, 0, 0, 0, 0]
  const head: u8[] = [0x16, 0x03, 0x01]
  out.set(head, 0)
  out.fill(0xff, 3, -1)
  return out
}
