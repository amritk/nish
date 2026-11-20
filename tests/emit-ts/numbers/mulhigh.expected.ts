// WP41: `mulHigh` written out is the call itself, imported from nish/runtime,
// where a `u64` is a BigInt and the high half is the exact product shifted
// down. Node and the native binary must print the same lines. The literal
// operands of the last line are typed `u64` by the call, so they are BigInts
// in the TypeScript too.
import { convert, shlU64, mulHigh } from "nish/runtime"
import type { u64 } from "nish/runtime"
const pairs = (): u64[] => {
  const all: u64 = BigInt.asUintN(64, ~convert(0, "i32", "u64"))
  const k32: u64 = 4294967296n
  return [convert(0, "i32", "u64"), convert(1, "i32", "u64"), BigInt.asUintN(64, k32 - convert(1, "i32", "u64")), k32, BigInt.asUintN(64, k32 + convert(1, "i32", "u64")), shlU64(convert(1, "i32", "u64"), convert(63, "i32", "u64")), all]
}

export const main = (): number => {
  const xs = pairs()
  for (const a of xs) {
    const row: string[] = []
    for (const b of xs) {
      row.push(`${mulHigh(a, b)}`)
    }
    console.log(row.join(" "))
  }
  console.log(`${mulHigh(0x100000000000n, 0x100000000000n)} ${mulHigh(3n, 5n)}`)
  return 0
}
