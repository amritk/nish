// `CountedBy` names the count C reads with a buffer, so it means nothing on a
// function written in Nish, whose arrays carry their own length.
const fill = (dst: CountedBy<u8[], "n">, n: u32): i32 => toI32(n) + dst.length

export const main = (): i32 => fill([1, 2], 2)
