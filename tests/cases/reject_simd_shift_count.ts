// A shift or rotate count is an integer literal below the lane width: the
// lowering is a splat constant, and a count of the width or more shifts every
// bit out (LLVM calls it poison) where a rotate would wrap it. A float vector
// has no shifts.
import { u32x4, u8x16, i32x4, f32x4, shl, shr, rotl, rotr } from "nish:simd";

export const f = (v: u32x4, n: i32): u32x4 => shl(v, n);
export const g = (v: u32x4): u32x4 => rotl(v, 32);
export const h = (v: u8x16): u8x16 => shr(v, 8);
export const j = (v: i32x4): i32x4 => rotr(v, -1);
export const k = (v: f32x4): f32x4 => shl(v, 1);
