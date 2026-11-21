// Every integer conversion `--emit-ts` writes inline rather than calling the
// runtime's `convert`, at the edges of each width: the 32-bit casts become
// `| 0`, `>>> 0` and masks, the 64-bit ones `BigInt.asIntN` and
// `BigInt.asUintN`, and f64 to i32 a clamp around `| 0`. Each line must print
// what the native build prints.
const fromI32 = (x: i32): string => `${toU8(x)} ${toU16(x)} ${toU32(x)} ${toI64(x)} ${toU64(x)} ${toF64(x)}`
const fromU32 = (x: u32): string => `${toU8(x)} ${toU16(x)} ${toI32(x)} ${toI64(x)} ${toU64(x)} ${toF64(x)}`
const fromU16 = (x: u16): string => `${toU8(x)} ${toI32(x)} ${toU32(x)} ${toI64(x)} ${toU64(x)}`
const fromU8 = (x: u8): string => `${toU16(x)} ${toI32(x)} ${toU32(x)} ${toI64(x)} ${toU64(x)}`
const fromI64 = (x: i64): string => `${toU8(x)} ${toU16(x)} ${toI32(x)} ${toU32(x)} ${toU64(x)}`
const fromU64 = (x: u64): string => `${toU8(x)} ${toU16(x)} ${toI32(x)} ${toU32(x)} ${toI64(x)}`
const fromF64 = (x: f64): i32 => toI32(x)

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
  const i64s: i64[] = [toI64(0), toI64(-1), toI64(65536) * toI64(65536) + toI64(5), toI64(-2147483648) - toI64(1)]
  for (const x of i64s) {
    console.log(`i64 ${x}: ${fromI64(x)}`)
  }
  const u64s: u64[] = [toU64(0), toU64(65536) * toU64(65536), toU64(-1)]
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
