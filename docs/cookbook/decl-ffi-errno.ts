import { cErrno } from "nish:unsafe"

declare function strtol(s: string, end: CPtr | null, base: i32): i64

const parse = (s: string): i64 => {
  const n = strtol(s, null, 10)
  return cErrno() === 0 ? n : -1
}

export const main = (): i32 => (parse("99999999999999999999") === -1 ? 0 : 1)
