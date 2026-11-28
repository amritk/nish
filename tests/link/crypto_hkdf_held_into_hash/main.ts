// A hash length other than 32 or 48 makes `hkdfExpandLabelHeldInto` answer
// `false`: it names no hash HKDF runs over here. `out` is left untouched.
import { Secret, secret, wipe } from "nish:secret";
import { hkdfExpandLabelHeldInto } from "nish/crypto/hkdf";

export const main = (): i32 => {
  const prk: Secret<u8[]> = secret(new Array<u8>(64));
  const context: u8[] = [];
  const out: u8[] = new Array<u8>(16);
  console.log("expanding over a 64-byte hash");
  const ok: boolean = hkdfExpandLabelHeldInto(toI32(64), prk, "quic key", context, out, toI32(0), toI32(16));
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
