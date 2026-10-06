// The scratch's HKDF under `--number-mode f64` with inputs longer than
// 2^31 - 1 bytes, where `toI32` of the length saturates and would MAC a
// prefix (docs/security/crypto-k1.md, K1-4). `hkdfExpandInto` answers `false`
// for such an `info`, as `hkdfExpandSha256` answers `null`; `hkdfExtractInto`
// panics for such an IKM ("hkdfExtractInto: input keying material longer
// than 2^31 - 1 bytes", on stderr), as `hmacSha256` does. Exit 1, and nothing
// on stdout after the line printed before the extract.
import { HkdfScratch, hkdfExpandInto, hkdfExtractInto } from "nish/crypto/hkdf";

export const main = (): i32 => {
  const kdf = new HkdfScratch();
  const n: number = 2147483648;
  const huge: u8[] = new Array<u8>(n);
  const prk: u8[] = new Array<u8>(48);
  const out: u8[] = new Array<u8>(48);
  const salt: u8[] = [];
  console.log(`hkdfExpandInto: a 2^31-byte info answers ${hkdfExpandInto(kdf, toI32(32), prk, huge, out, toI32(0), toI32(32))}`);
  hkdfExtractInto(kdf, toI32(32), salt, huge, out, toI32(0));
  console.log("unreachable: a 2^31-byte IKM was accepted");
  return 0;
};
