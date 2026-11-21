// Every integer conversion `--emit-ts` writes inline rather than calling the
// runtime's `convert`, at the edges of each width: the 32-bit casts become
// `| 0`, `>>> 0` and masks, the 64-bit ones `BigInt.asIntN` and
// `BigInt.asUintN`, and f64 to i32 a clamp around `| 0`. Each line must print
// what the native build prints.
import { toI64, toF64, toI32 } from "nish/runtime"
import type { i32, u32, u16, u8, i64, u64, f64 } from "nish/runtime"
const fromI32 = (x: i32): string => `${((x) & 255)} ${((x) & 65535)} ${((x) >>> 0)} ${BigInt(x)} ${BigInt.asUintN(64, BigInt(x))} ${(x)}`
const fromU32 = (x: u32): string => `${((x) & 255)} ${((x) & 65535)} ${((x) | 0)} ${BigInt(x)} ${BigInt(x)} ${(x)}`
const fromU16 = (x: u16): string => `${((x) & 255)} ${(x)} ${(x)} ${BigInt(x)} ${BigInt(x)}`
const fromU8 = (x: u8): string => `${(x)} ${(x)} ${(x)} ${BigInt(x)} ${BigInt(x)}`
const fromI64 = (x: i64): string => `${Number(BigInt.asUintN(8, x))} ${Number(BigInt.asUintN(16, x))} ${Number(BigInt.asIntN(32, x))} ${Number(BigInt.asUintN(32, x))} ${BigInt.asUintN(64, x)}`
const fromU64 = (x: u64): string => `${Number(BigInt.asUintN(8, x))} ${Number(BigInt.asUintN(16, x))} ${Number(BigInt.asIntN(32, x))} ${Number(BigInt.asUintN(32, x))} ${BigInt.asIntN(64, x)}`
const fromF64 = (x: f64): i32 => (x >= 2147483647 ? 2147483647 : x <= -2147483648 ? -2147483648 : x | 0)

export const main = (): i32 => {
  const i32s: i32[] = [0, 1, -1, 255, 256, -256, 65535, 65536, 2147483647, -2147483648]
  for (const x of i32s) {
    console.log(`i32 ${x}: ${fromI32(x)}`)
  }
  const u32s: u32[] = [0, 1, 255, 65536, 2147483647, 2147483648, 4294967295]
  for (const x of u32s) {
    console.log(`u32 ${x}: ${fromU32(x)}`)
  }
  const u16s: u16[] = [0, 255, 256, 65535]
  for (const x of u16s) {
    console.log(`u16 ${x}: ${fromU16(x)}`)
  }
  const u8s: u8[] = [0, 127, 128, 255]
  for (const x of u8s) {
    console.log(`u8 ${x}: ${fromU8(x)}`)
  }
  const i64s: i64[] = [BigInt(0), BigInt(-1), BigInt.asIntN(64, BigInt.asIntN(64, BigInt(65536) * BigInt(65536)) + BigInt(5)), BigInt.asIntN(64, BigInt(-2147483648) - BigInt(1))]
  for (const x of i64s) {
    console.log(`i64 ${x}: ${fromI64(x)}`)
  }
  const u64s: u64[] = [BigInt.asUintN(64, BigInt(0)), BigInt.asUintN(64, BigInt.asUintN(64, BigInt(65536)) * BigInt.asUintN(64, BigInt(65536))), BigInt.asUintN(64, BigInt(-1))]
  for (const x of u64s) {
    console.log(`u64 ${x}: ${fromU64(x)}`)
  }
  const f64s: f64[] = [0, 2.7, -2.7, 2147483646.5, 2147483647.5, 1e10, -1e10, -2147483648.5]
  for (const x of f64s) {
    console.log(`f64 ${x}: ${fromF64(x)}`)
  }
  const zero: f64 = 0
  console.log(`f64 NaN: ${fromF64(zero / zero)}`)
  return 0
}
