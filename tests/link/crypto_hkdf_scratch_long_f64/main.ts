// The scratch's HKDF under `--number-mode f64` with inputs longer than
// 2^31 - 1 bytes, where `toI32` of the length saturates and would MAC a
// prefix (docs/security/crypto-k1.md, K1-4). `hkdfExpandInto` answers `false`
// for such an `info`, as `hkdfExpandSha256` answers `null`; `hkdfExtractInto`
// MACs the whole IKM, as `hmacSha256` hashes its whole message. The expected
// PRK of 2^31 zero bytes under an empty salt is Python's
// `hmac.new(b"", ikm, hashlib.sha256)`.
import { HkdfScratch, hkdfExpandInto, hkdfExtractInto } from "nish/crypto/hkdf";

const HEX_DIGITS: string = "0123456789abcdef";

const hex = (bytes: u8[]): string => {
  const parts: string[] = [];
  for (const b of bytes) {
    const v: i32 = toI32(b);
    parts.push(HEX_DIGITS.substring(v >> 4, (v >> 4) + 1));
    parts.push(HEX_DIGITS.substring(v & 15, (v & 15) + 1));
  }
  return parts.join("");
};

export const main = (): i32 => {
  const kdf = new HkdfScratch();
  const n: number = 2147483648;
  const huge: u8[] = new Array<u8>(n);
  const prk: u8[] = new Array<u8>(48);
  const out: u8[] = new Array<u8>(32);
  const salt: u8[] = [];
  console.log(`hkdfExpandInto: a 2^31-byte info answers ${hkdfExpandInto(kdf, toI32(32), prk, huge, out, toI32(0), toI32(32))}`);
  hkdfExtractInto(kdf, toI32(32), salt, huge, out, toI32(0));
  console.log(`hkdfExtractInto: a 2^31-byte IKM gives ${hex(out)}`);
  return 0;
};
