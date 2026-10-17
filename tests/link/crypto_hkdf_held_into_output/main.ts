// An output window outside its array panics in `hkdfExpandLabelHeldInto`
// ("hkdfExpandLabelHeldInto: the output window is outside its array", on
// stderr) before the held secret is read: 16 bytes do not fit at out[9] of
// 24. Exit 1, and nothing on stdout after the line printed before the misuse.
import { Secret, secret, wipe } from "nish:secret";
import { hkdfExpandLabelHeldInto } from "nish/crypto/hkdf";

export const main = (): i32 => {
  const prk: Secret<u8[]> = secret(new Array<u8>(32));
  const context: u8[] = [];
  const out: u8[] = new Array<u8>(24);
  console.log("expanding 16 bytes at out[9] of 24");
  hkdfExpandLabelHeldInto(toI32(32), prk, "quic key", context, out, toI32(9), toI32(16));
  console.log("unreachable: an out-of-range output window was accepted");
  wipe(prk);
  return 0;
};
