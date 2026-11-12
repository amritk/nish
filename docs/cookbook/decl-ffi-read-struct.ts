import { readStruct } from "nish:unsafe"

declare class Lconv {
  decimalPoint: CPtr
  thousandsSep: CPtr
}
declare function localeconv(): CPtr

const current = (): Lconv => readStruct(localeconv())

export const main = (): i32 => {
  const lc = current()
  return lc.decimalPoint === lc.thousandsSep ? 1 : 0
}
