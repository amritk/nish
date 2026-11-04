// Shifts and rotates by a constant count on the four integer vectors: `shl`
// is `shl`, `shr` is `lshr` on an unsigned lane and `ashr` on an `i32` lane,
// and `rotl`/`rotr` are `llvm.fshl`/`llvm.fshr` with the vector as both
// halves. Each count is a splat constant, so no lane is shifted by a variable.
// The counts run from 0 to the lane width less one, and a high bit set in
// each operand shows which shift fills with copies of the sign.
import { u32x4, i32x4, u16x8, u8x16, shl, shr, rotl, rotr, extract } from "nish:simd";

export const main = (): number => {
  const u = u32x4(1, 0x80000001, 0xdeadbeef, 0x12345678);
  console.log(`${extract(shl(u, 4), 1)} ${extract(shr(u, 4), 1)} ${extract(rotl(u, 4), 1)} ${extract(rotr(u, 4), 1)}`);
  const i = i32x4(-16, 16, -1, 0x40000000);
  console.log(`${extract(shr(i, 2), 0)} ${extract(shr(i, 31), 2)} ${extract(shl(i, 1), 3)} ${extract(rotl(i, 1), 0)}`);
  const h = u16x8(1, 0x8001, 3, 4, 5, 6, 7, 0xffff);
  console.log(`${extract(rotl(h, 1), 1)} ${extract(shr(h, 15), 7)} ${extract(shl(h, 15), 0)} ${extract(rotr(h, 3), 7)}`);
  const b = u8x16(1, 0x81, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 255);
  console.log(`${extract(rotl(b, 7), 1)} ${extract(shr(b, 7), 15)} ${extract(shl(b, 0), 2)} ${extract(rotr(b, 1), 0)}`);
  return 0;
};
