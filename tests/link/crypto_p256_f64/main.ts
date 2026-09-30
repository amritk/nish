// `nish/crypto/p256` in a program compiled with `--number-mode f64`, where
// every bare `number` and every unannotated literal is an `f64`. The module
// spells its widths, so its answers must not move: RFC 6979 A.2.5's key pair
// and its SHA-256 signature of "sample", that signature verified and a bit of
// it refused, and a private key of 0 refused. `crypto_p256` has the rest, and
// the hex helper both programs share.
import { Suite } from "nish/testing";
import { p256PublicKey, p256SignSha256, p256VerifySha256 } from "nish/crypto/p256";
import { fromHex, toHex } from "../crypto_p256/hex";

export const main = (): i32 => {
  const t = new Suite("p256 (f64 mode)");

  // RFC 6979 A.2.5.
  const priv: u8[] = fromHex("c9afa9d845ba75166b5c215767b1d6934e50c3db36e89b127b8a622b120f6721");
  const pub: u8[] | null = p256PublicKey(priv);
  t.eqStr(
    "A.2.5 public key of the private key",
    toHex(pub),
    "0460fed4ba255a9d31c961eb74c6356d68c049b8923b61fa6ce669622e60f29fb67903fe1008b8bc99a41ae9e95628bc64f2f1b20c2d7e9f5177a3c294d4462299"
  );
  // "sample" as ASCII.
  const sample: u8[] = fromHex("73616d706c65");
  const sig: u8[] | null = p256SignSha256(priv, sample);
  t.eqStr(
    "A.2.5 SHA-256 \"sample\": r || s",
    toHex(sig),
    "efd48b2aacb6a8fd1140dd9cd45e81d69d2c877b56aaf991c34d0ea84eaf3716f7cb1c942d657c41d436c7a1b6e29f65f3e900dbb9aff4064dc4ab2f843acda8"
  );
  if (pub !== null && sig !== null) {
    t.ok("it verifies", p256VerifySha256(pub, sample, sig));
    sig[63] = sig[63] ^ toU8(1);
    t.ok("with a bit of s flipped it does not", !p256VerifySha256(pub, sample, sig));
  }
  t.eqStr(
    "private key 0 answers null",
    toHex(p256PublicKey(fromHex("0000000000000000000000000000000000000000000000000000000000000000"))),
    "null"
  );

  return t.done();
};
