// `P256SignScratch`'s arrays are public fields, so an importer can replace
// one with an array of the wrong length. `p256SignSha256Into` then answers
// `false` and leaves the signature unwritten, rather than panicking or
// signing with the part that fits: a limb array the signing loop computes in
// (the affine `x`, the half `r`, the nonce limbs `kM`, the comb digits) is
// refused before the first step, each helper that reads a resized buffer (the
// digest bytes `h1`, the nonce `v`, the comb table) refuses, and every
// refusal leaves through the scratch's one wipe. A constant of the right
// length overwritten so that r or s is zero on every round (R^2 zeroed) is
// refused once the RFC 6979 rounds run out, not looped on. The same scratch signs before the swap and
// after it is put right, so each `false` is the refusal it names. Each line
// also reads the scratch's K, V and nonce limbs after the call, so the wipe
// on every exit is checked, not read from the code.
import { Secret, secret, wipe } from "nish:secret";
import { P256SignScratch, p256SignSha256Into } from "nish/crypto/p256";

const sign = (name: string, scratch: P256SignScratch): void => {
  const raw: u8[] = new Array<u8>(32);
  raw[31] = toU8(7);
  const key: Secret<u8[]> = secret(raw);
  const msg: u8[] = [0x61, 0x62, 0x63];
  const sig: u8[] = new Array<u8>(64);
  const ok: boolean = p256SignSha256Into(scratch, key, msg, toI32(0), toI32(3), sig, toI32(0));
  wipe(key);
  let written: i32 = 0;
  for (let i: i32 = 0; i < toI32(sig.length); i++) {
    written = written | toI32(sig[i]);
  }
  // RFC 6979's K and V and the nonce limbs are zero after every return,
  // refused or not: each leaves through the scratch's one wipe.
  let held: u32 = 0;
  for (const b of scratch.k) {
    held = held | toU32(b);
  }
  for (const b of scratch.v) {
    held = held | toU32(b);
  }
  for (const w of scratch.kM) {
    held = held | w;
  }
  console.log(`${name}: ${ok}, signature ${written === 0 ? "unwritten" : "written"}, k v kM ${held === 0 ? "zero" : "held"}`);
};

export const main = (): i32 => {
  const scratch = new P256SignScratch();
  sign("fresh scratch", scratch);
  const block: u8[] = scratch.block;
  scratch.block = [];
  sign("block emptied", scratch);
  scratch.block = block;
  const tail: u8[] = scratch.tail;
  scratch.tail = new Array<u8>(64);
  sign("tail shortened", scratch);
  scratch.tail = tail;
  const kt: u32[] = scratch.kt;
  scratch.kt = new Array<u32>(8);
  sign("round constants shortened", scratch);
  scratch.kt = kt;
  const message: u8[] = scratch.message;
  scratch.message = new Array<u8>(32);
  sign("nonce message shortened", scratch);
  scratch.message = message;
  const h1: u8[] = scratch.h1;
  scratch.h1 = new Array<u8>(16);
  sign("digest bytes shortened", scratch);
  scratch.h1 = h1;
  const z: u32[] = scratch.z;
  scratch.z = new Array<u32>(4);
  sign("digest scalar shortened", scratch);
  scratch.z = z;
  const v: u8[] = scratch.v;
  scratch.v = new Array<u8>(16);
  sign("nonce shortened", scratch);
  scratch.v = v;
  const kM: u32[] = scratch.kM;
  scratch.kM = new Array<u32>(4);
  sign("nonce limbs shortened", scratch);
  scratch.kM = kM;
  const r: u32[] = scratch.r;
  scratch.r = new Array<u32>(4);
  sign("signature half shortened", scratch);
  scratch.r = r;
  const x: u32[] = scratch.x;
  scratch.x = new Array<u32>(4);
  sign("affine x shortened", scratch);
  scratch.x = x;
  const r2: u32[] = scratch.r2;
  scratch.r2 = new Array<u32>(8);
  sign("Montgomery constant zeroed", scratch);
  scratch.r2 = r2;
  const comb: u32[] = scratch.points.comb;
  scratch.points.comb = new Array<u32>(4);
  sign("comb digits shortened", scratch);
  scratch.points.comb = comb;
  const table: u32[] = scratch.table;
  scratch.table = new Array<u32>(16);
  sign("table shortened", scratch);
  scratch.table = table;
  sign("put right", scratch);
  return 0;
};
