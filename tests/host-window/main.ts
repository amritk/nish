// WP50 stage 3: a host function borrows a window of a module array. Each
// export builds [1, 2, 3, 4], lends the middle two, and answers the sum of all
// four, so a host write shows as 1 + 4 + 6 + 4 = 15 and a read as 5.
import { doubleF32, doubleI32, doubleU8, doubleU16, doubleU32, sumF64 } from "./host"

export const u8s = (): u32 => {
  const xs: u8[] = [1, 2, 3, 4]
  doubleU8(xs, 1, 2)
  return toU32(xs[0]) + toU32(xs[1]) + toU32(xs[2]) + toU32(xs[3])
}

export const u16s = (): u32 => {
  const xs: u16[] = [1, 2, 3, 4]
  doubleU16(xs, 1, 2)
  return toU32(xs[0]) + toU32(xs[1]) + toU32(xs[2]) + toU32(xs[3])
}

export const u32s = (): u32 => {
  const xs: u32[] = [1, 2, 3, 4]
  doubleU32(xs, 1, 2)
  return xs[0] + xs[1] + xs[2] + xs[3]
}

export const i32s = (): i32 => {
  const xs: i32[] = [1, 2, 3, 4]
  doubleI32(xs, 1, 2)
  return xs[0] + xs[1] + xs[2] + xs[3]
}

export const f32s = (): f32 => {
  const xs: f32[] = [1, 2, 3, 4]
  doubleF32(xs, 1, 2)
  return xs[0] + xs[1] + xs[2] + xs[3]
}

export const f64s = (): f64 => {
  const xs: f64[] = [1, 2, 3, 4]
  return sumF64(xs, 1, 2)
}

/** The whole array, lent as `0, toU32(xs.length)`: a window the check is proven for. */
export const whole = (): i32 => {
  const xs: i32[] = [1, 2, 3, 4]
  doubleI32(xs, 0, toU32(xs.length))
  return xs[0] + xs[1] + xs[2] + xs[3]
}

/** A window past the end panics before the page runs. */
export const past = (): i32 => {
  const xs: i32[] = [1, 2, 3, 4]
  doubleI32(xs, 3, 2)
  return xs[0]
}

/** `at + n` that wraps in 32 bits is still past the end. */
export const wraps = (): i32 => {
  const xs: i32[] = [1, 2, 3, 4]
  doubleI32(xs, 4294967295, 2)
  return xs[0]
}

const KEPT = new Int32Array(4)

/** Module storage lent to a window: the host's writes land in storage and outlive the call. */
export const stored = (): i32 => {
  for (let i = 0; i < KEPT.length; i++) {
    KEPT[i] = KEPT[i] + i + 1
  }
  doubleI32(KEPT, 1, 2)
  return KEPT[0] + KEPT[1] + KEPT[2] + KEPT[3]
}
