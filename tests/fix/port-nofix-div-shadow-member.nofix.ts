// A class field or method named `toI32` gets the module no review edit: the
// decline reads every name the module declares, members included.
class Scale {
  toI32: i32 = 1000
  toU8(x: u8): u8 {
    return x
  }
}

const f = (a: i32, b: i32): i32 => a / b
const h = (a: u8, b: u8): u8 => a / b

export const main = (): i32 => {
  const s = new Scale()
  const three: u8 = 3
  console.log(`${f(17, 4)} ${h(17, 4)} ${s.toI32} ${s.toU8(three)}`)
  return 0
}
