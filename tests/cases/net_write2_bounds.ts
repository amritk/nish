// `netWrite2` checks both ranges, `0 <= off <= off + len <= buf.length`,
// before the call, as `netWrite` checks its one, through the slice panic and
// with its words. In range, the call reaches the runtime, which answers -9 for
// the closed descriptor; `net_write2_bounds.c` runs each range that is not in
// a child and prints its message and its exit status, and then calls the runtime
// directly under a stand-in `sendmsg` that prints the message it was handed.

// The call only reads its two buffers, so they may be `readonly`.
const send = (a: readonly u8[], aOff: i32, aLen: i32, b: readonly u8[], bOff: i32, bLen: i32): i32 =>
  netWrite2(-1, a, aOff, aLen, b, bOff, bLen)

const writeAt = (aOff: i32, aLen: i32, bOff: i32, bLen: i32): i32 => {
  const a: u8[] = [1, 2, 3, 4]
  const b: u8[] = [5, 6, 7, 8, 9, 10]
  return send(a, aOff, aLen, b, bOff, bLen)
}

export const firstPastEnd = (): i32 => writeAt(2, 3, 0, 6)

export const secondPastEnd = (): i32 => writeAt(0, 4, 5, 2)

export const secondNegative = (): i32 => writeAt(0, 4, -1, 1)

export const test = (): i32 => writeAt(0, 4, 0, 6) + writeAt(4, 0, 6, 0)
