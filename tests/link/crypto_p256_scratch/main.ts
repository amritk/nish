// `P256SignScratch`'s arrays are public fields, so an importer can replace
// one with an array of the wrong length. `p256SignSha256Into` then answers
// `false` and leaves the signature unwritten, rather than panicking or
// signing with the part that fits. The same scratch signs before the swap
// and after it is put right, so each `false` is the refusal it names.
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
  console.log(`${name}: ${ok}, signature ${written === 0 ? "unwritten" : "written"}`);
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
  sign("put right", scratch);
  return 0;
};
