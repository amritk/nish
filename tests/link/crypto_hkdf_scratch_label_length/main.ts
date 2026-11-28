// HKDF-Expand-Label through the scratch answers `false` for a length past
// 255 bytes, as `hkdfExpandLabelSha256` panics on one, and leaves `out`
// untouched.
import { HkdfScratch, hkdfExpandLabelInto } from "nish/crypto/hkdf";

export const main = (): i32 => {
  const kdf = new HkdfScratch();
  const secret: u8[] = new Array<u8>(32);
  const none: u8[] = [];
  const out: u8[] = new Array<u8>(300);
  console.log("expanding 256 bytes");
  const ok: boolean = hkdfExpandLabelInto(kdf, toI32(32), secret, "key", none, toI32(0), toI32(0), out, toI32(0), toI32(256));
  let touched = false;
  for (let i = 0; i < out.length; i += 1) {
    if (out[i] !== toU8(0)) {
      touched = true;
    }
  }
  console.log(`refused: ${!ok}, out untouched: ${!touched}`);
  return 0;
};
