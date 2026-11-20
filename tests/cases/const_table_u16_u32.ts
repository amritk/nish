// `u16` and `u32` constant tables, each element folded from literals and
// other constants, read by index, by `for...of`, through a `readonly`
// parameter and by `.length`, with the width's maximum at both ends.
const BASE: i32 = 1000

const WIDE: readonly u16[] = [0, 1, 255, 256, BASE, BASE * 2 + 1, 32768, 65535]
// The u32 values above 2^31 are literals, not folded from an i64 constant:
// --emit-ts lowers i64 arithmetic to bigint and mixes it with numbers (#1827).
const MASKS: readonly u32[] = [0, 1, 65535, 65536, 4000000000, 4294967295, 2147483648, 4294967295]

const wideSum = (xs: readonly u16[]): u32 => {
  let s: u32 = 0
  for (const x of xs) {
    s += toU32(x)
  }
  return s
}

const maskXor = (xs: readonly u32[]): u32 => {
  let s: u32 = 0
  for (let i = 0; i < xs.length; i++) {
    s = s ^ xs[i]
  }
  return s
}

export const main = (): void => {
  const wide: string[] = []
  for (const w of WIDE) {
    wide.push(`${w}`)
  }
  console.log(`u16 ${WIDE.length}: ${wide.join(" ")}`)
  const masks: string[] = []
  for (const m of MASKS) {
    masks.push(`${m}`)
  }
  console.log(`u32 ${MASKS.length}: ${masks.join(" ")}`)
  console.log(`${wideSum(WIDE)} ${maskXor(MASKS)}`)
  // Wraps at the element's width, as any u16 or u32 add does.
  console.log(`${WIDE[7] + toU16(1)} ${MASKS[7] + toU32(1)}`)
}
