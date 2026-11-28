// `hkdfExpandLabelSha256Held` answers `false` for a `dst` past 255 bytes, as
// `hkdfExpandLabelSha256` panics on one, and leaves `dst` untouched.
import { Secret, secret, wipe } from "nish:secret";
import { hkdfExpandLabelSha256Held } from "nish/crypto/hkdf";

export const main = (): i32 => {
  const prk: Secret<u8[]> = secret(new Array<u8>(32));
  const dst: Secret<u8[]> = secret(new Array<u8>(256));
  const context: u8[] = [];
  console.log("expanding into a 256-byte secret");
  const ok: boolean = hkdfExpandLabelSha256Held(dst, prk, "quic key", context);
  console.log(`refused: ${!ok}`);
  wipe(prk);
  wipe(dst);
  return 0;
};
