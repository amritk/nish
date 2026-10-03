// Panic sites: `s.slice(a, b)` and `dst.set(src, at)` check the range they
// read or write through the slice panic; `substring` clamps instead, and is
// not a site.
const middle = (s: string): string => s.slice(1, 3)

const clamped = (s: string): string => s.substring(1, 30)

const copyInto = (dst: u8[], src: u8[]): void => {
  dst.set(src, 1)
}

export const main = (): number => {
  console.log(middle("abcd"))
  console.log(clamped("abcd"))
  const dst: u8[] = [0, 0, 0, 0]
  const src: u8[] = [7, 8]
  copyInto(dst, src)
  console.log(dst[1] + dst[2])
  return 0
}
