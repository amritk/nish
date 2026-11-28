// HKDF-Expand-Label through the scratch answers `false` for a secret shorter
// than HashLen, as `hkdfExpandLabelSha384` panics on one (RFC 5869 §2.3;
// docs/security/crypto-k1.md, K1-5), and leaves `out` untouched.
import { HkdfScratch, hkdfExpandLabelInto } from "nish/crypto/hkdf";

export const main = (): i32 => {
  const kdf = new HkdfScratch();
  const secret: u8[] = new Array<u8>(47);
  const none: u8[] = [];
  const out: u8[] = new Array<u8>(16);
  console.log("expanding a 47-byte secret over SHA-384");
  const ok: boolean = hkdfExpandLabelInto(kdf, toI32(48), secret, "key", none, toI32(0), toI32(0), out, toI32(0), toI32(16));
  let touched = false;
  for (let i = 0; i < out.length; i += 1) {
    if (out[i] !== toU8(0)) {
      touched = true;
    }
  }
  console.log(`refused: ${!ok}, out untouched: ${!touched}`);
  return 0;
};
