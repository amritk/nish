// A literal divisor bounds its quotient, and what reads the quotient uses the
// proof: `a / 4 + 1` on i32 skips its overflow check, and `ys[a / 4]` under
// `a < 16` its bounds check. The review edit's same-type conversion keeps the
// quotient's range, so each reviewed form compiles to the input's IR, for
// each conversion, a loop to `a / 4` among them. Where the input drops a check
// (`addI32`'s overflow, `atI32`'s bounds, `sumU8`'s `i * 1000000`, listed in
// `.ll-lacks`) the reviewed form drops it too; an unsigned index keeps its
// bounds check either way.
const addI32 = (a: i32): i32 => toI32(a / 4) + 1
const addU8 = (a: u8): u8 => toU8(a / 4) + 1
const addU16 = (a: u16): u16 => toU16(a / 4) + 1
const addU32 = (a: u32): u32 => toU32(a / 4) + 1

const atI32 = (a: i32): i32 => {
  const ys: i32[] = [10, 20, 30, 40]
  return a >= 0 && a < 16 ? ys[toI32(a / 4)] : 0
}
const atU8 = (a: u8): i32 => {
  const ys: i32[] = [10, 20, 30, 40]
  return a < 16 ? ys[toU8(a / 4)] : 0
}
const atU16 = (a: u16): i32 => {
  const ys: i32[] = [10, 20, 30, 40]
  return a < 16 ? ys[toU16(a / 4)] : 0
}
const atU32 = (a: u32): i32 => {
  const ys: i32[] = [10, 20, 30, 40]
  return a < 16 ? ys[toU32(a / 4)] : 0
}

const sumI32 = (a: i32): i32 => {
  let s: i32 = 0
  if (a >= 0 && a < 16) {
    for (let i: i32 = 0; i < toI32(a / 4); i++) {
      s = s ^ (i * 1000000)
    }
  }
  return s
}

const sumU8 = (a: u8): i32 => {
  let s: i32 = 0
  if (a < 16) {
    for (let i: u8 = 0; i < toU8(a / 4); i++) {
      s = s ^ (toI32(i) * 1000000)
    }
  }
  return s
}

const sumU16 = (a: u16): i32 => {
  let s: i32 = 0
  if (a < 16) {
    for (let i: u16 = 0; i < toU16(a / 4); i++) {
      s = s ^ (toI32(i) * 1000000)
    }
  }
  return s
}

const sumU32 = (a: u32): i32 => {
  let s: i32 = 0
  if (a < 16) {
    for (let i: u32 = 0; i < toU32(a / 4); i++) {
      s = s ^ (toI32(i) * 1000000)
    }
  }
  return s
}

export const main = (): i32 => {
  console.log(`${addI32(41)} ${addU8(255)} ${addU16(65535)} ${addU32(4294967295)}`)
  console.log(`${atI32(13)} ${atU8(9)} ${atU16(5)} ${atU32(2)}`)
  console.log(`${sumI32(15)} ${sumU8(12)} ${sumU16(8)} ${sumU32(3)}`)
  return 0
}
