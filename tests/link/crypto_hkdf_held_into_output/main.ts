// An output window outside its array makes `hkdfExpandLabelHeldInto` answer
// `false` before the held secret is read: 16 bytes do not fit at out[9] of
// 24. `out` is left untouched.
import { Secret, secret, wipe } from "nish:secret";
import { hkdfExpandLabelHeldInto } from "nish/crypto/hkdf";

export const main = (): i32 => {
  const prk: Secret<u8[]> = secret(new Array<u8>(32));
  const context: u8[] = [];
  const out: u8[] = new Array<u8>(24);
  console.log("expanding 16 bytes at out[9] of 24");
  const ok: boolean = hkdfExpandLabelHeldInto(toI32(32), prk, "quic key", context, out, toI32(9), toI32(16));
  let touched = false;
  for (let i = 0; i < out.length; i += 1) {
    if (out[i] !== toU8(0)) {
      touched = true;
    }
  }
  console.log(`refused: ${!ok}, out untouched: ${!touched}`);
  wipe(prk);
  return 0;
};
