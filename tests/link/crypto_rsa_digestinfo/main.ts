// Hand-built RSA signatures, each breaking one rule of RFC 8017, against
// `nish/crypto/rsa`. Wycheproof covers the same ground in bulk; these pin the
// rules by name, so a regression reads as the rule it broke.
import { Suite } from "nish/testing";
import {
  RSA_HASH_SHA256,
  RSA_HASH_SHA384,
  RsaPublicKey,
  rsaParsePublicKey,
  rsaVerifyPkcs1v15,
  rsaVerifyPss,
} from "nish/crypto/rsa";
import { fromHex } from "../crypto_rsa_wycheproof/hex";
import {
  digestInfoCases,
  keyDer,
  message,
  modulus,
  pssLongSaltSig,
  pssNoSaltSig,
  pssSig,
  smallKeyDer,
} from "./vectors";

/** `der` with the byte at `at` replaced by `value`, for keys broken in one place. */
const withByte = (der: u8[], at: i32, value: u8): u8[] => {
  const out: u8[] = [];
  let i: i32 = 0;
  for (const b of der) {
    out.push(i === at ? value : b);
    i += 1;
  }
  return out;
};

export const main = (): i32 => {
  const t = new Suite("rsa digestinfo");
  const der: u8[] = fromHex(keyDer());
  const last: i32 = toI32(der.length) - 1;

  t.ok("a 1024-bit key is refused", rsaParsePublicKey(fromHex(smallKeyDer())) === null);
  const trailing: u8[] = fromHex(keyDer());
  trailing.push(0);
  t.ok("a key with a byte after its SEQUENCE is refused", rsaParsePublicKey(trailing) === null);
  // The DER ends with the exponent 65537, `02 03 01 00 01`, and the modulus
  // ends just before it.
  t.ok("a key with an even exponent is refused", rsaParsePublicKey(withByte(der, last, 0)) === null);
  t.ok("a key with an even modulus is refused", rsaParsePublicKey(withByte(der, last - 5, 0)) === null);

  const parsed: RsaPublicKey | null = rsaParsePublicKey(der);
  if (parsed === null) {
    t.fail("the 2048-bit key parses", "rsaParsePublicKey refused it");
    return t.done();
  }
  const key: RsaPublicKey = parsed;
  t.ok("the 2048-bit key parses", true);
  const msg: u8[] = fromHex(message());

  for (const c of digestInfoCases()) {
    t.eqBool(c.name, rsaVerifyPkcs1v15(key, RSA_HASH_SHA256, msg, fromHex(c.sig)), c.valid);
  }
  const good: u8[] = fromHex(digestInfoCases()[0].sig);
  t.eqBool("a SHA-256 signature checked as SHA-384 is refused", rsaVerifyPkcs1v15(key, RSA_HASH_SHA384, msg, good), false);
  const short: u8[] = fromHex(digestInfoCases()[0].sig);
  short.pop();
  t.eqBool("a signature one byte short is refused", rsaVerifyPkcs1v15(key, RSA_HASH_SHA256, msg, short), false);
  t.eqBool("a signature equal to the modulus is refused", rsaVerifyPkcs1v15(key, RSA_HASH_SHA256, msg, fromHex(modulus())), false);

  t.eqBool("a PSS signature with a 32-byte salt verifies", rsaVerifyPss(key, RSA_HASH_SHA256, msg, fromHex(pssSig())), true);
  t.eqBool("a PSS signature with no salt is refused, as sLen is hLen", rsaVerifyPss(key, RSA_HASH_SHA256, msg, fromHex(pssNoSaltSig())), false);
  t.eqBool("a PSS signature with a 64-byte salt is refused", rsaVerifyPss(key, RSA_HASH_SHA256, msg, fromHex(pssLongSaltSig())), false);
  t.eqBool("a PKCS#1 v1.5 signature is refused as PSS", rsaVerifyPss(key, RSA_HASH_SHA256, msg, good), false);
  t.eqBool("a PSS signature is refused as PKCS#1 v1.5", rsaVerifyPkcs1v15(key, RSA_HASH_SHA256, msg, fromHex(pssSig())), false);
  return t.done();
};
