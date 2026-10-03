// wp31 §2's getByte, with the index declared `integer<0, 255>` (WP31 §10
// step 3). `getByte`, `sumInline` and `sumCalled` are
// `tests/cases/perf_rng_getbyte`'s three functions verbatim: the golden pins
// their IR -- no bounds check, no range check, all three
// `{ nounwind willreturn readonly }` -- and this file times them.
//
// They are not exported, so `getByte` has no host-boundary prologue (wp31 §9)
// and what is timed is the closed program §2's `opt -O3` result is about.
// `main` runs both sums 256 times a round, and changes one byte of the table
// between passes so that no pass is the previous one folded. Every index in
// `main` is proven by its loop condition, so the two builds differ in nothing
// but what the flag would take out of the three functions.
//
//   build/nish bench/getbyte.ts --link build/getbyte --profile speed
//   build/nish bench/getbyte.ts --link build/getbyte-unchecked --profile speed --unchecked-indexing
//
// wp31 §10 records the protocol and the numbers.

const ROUNDS: i32 = 65536 // bench:n

const getByte = (buf: u8[], i: integer<0, 255>): u8 => {
  if (buf.length < 256) {
    return 0
  }
  return buf[i]
}

const sumInline = (buf: u8[]): i32 => {
  if (buf.length < 256) {
    return 0
  }
  let sum = 0
  for (let i = 0; i < 256; i++) {
    sum = sum + toI32(buf[i])
  }
  return sum
}

const sumCalled = (buf: u8[]): i32 => {
  let sum = 0
  for (let i = 0; i < 256; i++) {
    sum = sum + toI32(getByte(buf, i))
  }
  return sum
}

export const main = (): number => {
  const table: u8[] = new Array<u8>(256)
  for (let k = 0; k < table.length; k++) {
    table[k] = toU8(k)
  }
  // A checksum, so `u64`: it is folded rather than counted, and unsigned
  // arithmetic is defined to wrap and never checked.
  let checksum: u64 = 0
  for (let round = 0; round < ROUNDS; round++) {
    for (let k = 0; k < table.length; k++) {
      checksum = checksum + toU64(sumInline(table)) + toU64(sumCalled(table))
      table[k] = toU8(round + 1)
    }
  }
  console.log(`${ROUNDS} rounds of 256 passes, checksum ${checksum}`)
  return 0
}
