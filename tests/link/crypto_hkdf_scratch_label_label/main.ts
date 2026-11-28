// HKDF-Expand-Label through the scratch answers `false` for an empty label,
// as `hkdfExpandLabelSha256` panics on one, and leaves `out` untouched.
import { HkdfScratch, hkdfExpandLabelInto } from "nish/crypto/hkdf";

export const main = (): i32 => {
  const kdf = new HkdfScratch();
  const secret: u8[] = new Array<u8>(32);
  const none: u8[] = [];
  const out: u8[] = new Array<u8>(16);
  console.log("expanding with an empty label");
  const ok: boolean = hkdfExpandLabelInto(kdf, toI32(32), secret, "", none, toI32(0), toI32(0), out, toI32(0), toI32(16));
  let touched = false;
  for (let i = 0; i < out.length; i += 1) {
    if (out[i] !== toU8(0)) {
      touched = true;
    }
  }
  console.log(`refused: ${!ok}, out untouched: ${!touched}`);
  return 0;
};
