// HKDF-Expand-Label through the scratch panics on a secret shorter than
// HashLen ("hkdfExpandLabelInto: a secret shorter than HashLen", on stderr),
// as `hkdfExpandLabelSha384` does (RFC 5869 §2.3; docs/security/crypto-k1.md,
// K1-5). Exit 1, and nothing on stdout after the line printed before the
// misuse.
import { HkdfScratch, hkdfExpandLabelInto } from "nish/crypto/hkdf";

export const main = (): i32 => {
  const kdf = new HkdfScratch();
  const secret: u8[] = new Array<u8>(47);
  const none: u8[] = [];
  const out: u8[] = new Array<u8>(16);
  console.log("expanding a 47-byte secret over SHA-384");
  hkdfExpandLabelInto(kdf, toI32(48), secret, "key", none, toI32(0), toI32(0), out, toI32(0), toI32(16));
  console.log("unreachable: a short secret was accepted");
  return 0;
};
