// A hash length other than 32 or 48 panics in `hkdfExpandLabelHeldInto`
// ("hkdfExpandLabelHeldInto: a hash length of 64, not 32 or 48", on stderr):
// it names no hash HKDF runs over here, and is the caller's bug. Exit 1, and
// nothing on stdout after the line printed before the misuse.
import { Secret, secret, wipe } from "nish:secret";
import { hkdfExpandLabelHeldInto } from "nish/crypto/hkdf";

export const main = (): i32 => {
  const prk: Secret<u8[]> = secret(new Array<u8>(64));
  const context: u8[] = [];
  const out: u8[] = new Array<u8>(16);
  console.log("expanding over a 64-byte hash");
  hkdfExpandLabelHeldInto(toI32(64), prk, "quic key", context, out, toI32(0), toI32(16));
  console.log("unreachable: a 64-byte hash was accepted");
  wipe(prk);
  return 0;
};
