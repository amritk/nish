// A hash length other than 32 or 48 panics in the scratch's HKDF
// ("hkdfExpandInto: a hash length of 64, not 32 or 48", on stderr): it names
// no hash HKDF runs over here, and is the caller's bug. Exit 1, and nothing on
// stdout after the line printed before the misuse.
import { HkdfScratch, hkdfExpandInto } from "nish/crypto/hkdf";

export const main = (): i32 => {
  const kdf = new HkdfScratch();
  const prk: u8[] = new Array<u8>(64);
  const info: u8[] = [];
  const out: u8[] = new Array<u8>(16);
  console.log("expanding over a 64-byte hash");
  const ok: boolean = hkdfExpandInto(kdf, toI32(64), prk, info, out, toI32(0), toI32(16));
  console.log(`unreachable: answered ${ok}`);
  return 0;
};
