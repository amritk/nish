// WP66 S5: a buffer names its count with `CountedBy`, at any unsigned width
// and in any position. `z_fill` takes zlib's `uInt` (a `u32`) after its
// buffer; `z_sum` takes a `u16` before its buffer; `z_copy` is zlib's
// `compress`, whose `uLongf *destLen` is the out class `OutLen`, read before
// the call and written by C. Each count is held to its buffer's length before
// C runs: `toU32(buf.length)` of the buffer itself is proven and carries no
// check, the narrow `u16` is widened with `zext` and checked, and the out
// class's field is loaded after every argument ran and checked. `z_first`
// (WP89 S2) names an `f32[]`'s count, in elements, the same way.
declare class OutLen {
  value: u64
}

declare function z_fill(dst: CountedBy<u8[], "n">, n: u32, v: u8): i32
declare function z_sum(n: u16, src: CountedBy<readonly u8[], "n">): u32
declare function z_copy(
  dest: CountedBy<u8[], "destLen">,
  destLen: OutLen,
  source: CountedBy<readonly u8[], "sourceLen">,
  sourceLen: u64
): i32
declare function z_first(n: u32, xs: CountedBy<readonly f32[], "n">): f32

export const run = (): i32 => {
  const buf = new Array<u8>(6)
  z_fill(buf, toU32(buf.length), 7)
  console.log(`z_fill: ${buf[0]} ${buf[5]}`)
  console.log(`z_sum: ${z_sum(toU16(4), buf)}`)
  const dest = new Array<u8>(8)
  const destLen = new OutLen()
  destLen.value = toU64(dest.length)
  const source: u8[] = [104, 105, 33]
  const status = z_copy(dest, destLen, source, toU64(source.length))
  console.log(`z_copy: ${status} ${destLen.value} ${dest[0]} ${dest[2]}`)
  const xs: f32[] = [toF32(1.5), toF32(2)]
  console.log(`z_first: ${z_first(toU32(xs.length), xs)}`)
  return status
}
