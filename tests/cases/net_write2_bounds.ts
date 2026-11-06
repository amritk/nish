// `netWrite2` checks both ranges, `0 <= off <= off + len <= buf.length`,
// before the call, as `netWrite` checks its one, through the slice panic and
// with its words. In range, the call reaches the runtime, which answers -9 for
// the closed descriptor; `net_write2_bounds.c` runs each range that is not in
// a child and prints its message and its exit status.
const writeAt = (aOff: i32, aLen: i32, bOff: i32, bLen: i32): i32 => {
  const a: u8[] = [1, 2, 3, 4]
  const b: u8[] = [5, 6, 7, 8, 9, 10]
  return netWrite2(-1, a, aOff, aLen, b, bOff, bLen)
}

export const firstPastEnd = (): i32 => writeAt(2, 3, 0, 6)

export const secondPastEnd = (): i32 => writeAt(0, 4, 5, 2)

export const secondNegative = (): i32 => writeAt(0, 4, -1, 1)

export const test = (): i32 => writeAt(0, 4, 0, 6) + writeAt(4, 0, 6, 0)
