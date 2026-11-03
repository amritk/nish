import { u32x4, i32x4, addWrapping, xor, rotl, shr } from "nish:simd"

export const quarterStep = (a: u32x4, b: u32x4, d: u32x4): u32x4 => rotl(xor(d, addWrapping(a, b)), 16)

export const halve = (v: i32x4): i32x4 => shr(v, 1)
