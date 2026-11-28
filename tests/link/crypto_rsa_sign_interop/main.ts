// RSASSA-PSS-SHA256 signing (`nish/crypto/rsa-sign`) against other
// implementations: NIST CAVP's FIPS 186-2 signatures, and keys OpenSSL, Go's
// crypto/rsa and pyca/cryptography made, with signatures they made and
// verified (vectors.ts says which library did what). Each key is loaded twice,
// from the PKCS #1 DER its library wrote by `rsaParsePrivateKey` and from its
// PKCS #8 PEM by `x509ParseRsaPrivateKey`, and both loads must sign every case
// to the same bytes; keys outside what nish signs with must be refused by both.
import { Secret, wipe } from "nish:secret";
import {
  rsaParsePrivateKey,
  rsaPrivateKeyBits,
  rsaPrivateKeyExponent,
  rsaPrivateKeyModulus,
  rsaSignPssSha256,
  rsaSignPssSha256Salted,
} from "nish/crypto/rsa-sign";
import { RSA_HASH_SHA256, RsaPublicKey, rsaParsePublicKey, rsaVerifyPss } from "nish/crypto/rsa";
import { x509ParseRsaPrivateKey } from "nish/crypto/x509";
import { fromHex, toHex } from "../crypto_wycheproof_rsa/hex";
import { InteropCase, InteropKey, libraryCases, libraryKeys, nistCases, nistKeys, refusedKeys } from "./vectors";

/** What one set of keys and its cases came to. */
class Counts {
  loaded: i32 = 0;
  derived: i32 = 0;
  derivedOk: i32 = 0;
  salted: i32 = 0;
  saltedOk: i32 = 0;
  pemOk: i32 = 0;
  verified: i32 = 0;
}

/** The checks' PASS and FAIL lines and their totals. */
class Tally {
  passed: i32 = 0;
  failed: i32 = 0;

  /** Prints `name` under PASS or FAIL as `ok` says, and counts it. */
  check(name: string, ok: boolean): void {
    if (ok) {
      this.passed = this.passed + 1;
      console.log(`PASS  ${name}`);
    } else {
      this.failed = this.failed + 1;
      console.log(`FAIL  ${name}`);
    }
  }
}

/** `bytes` as hex with its leading zero bytes left out. */
const trimmed = (bytes: u8[]): string => {
  const out: u8[] = [];
  let lead: boolean = true;
  for (const b of bytes) {
    if (lead && toI32(b) === 0) {
      continue;
    }
    lead = false;
    out.push(b);
  }
  return toHex(out);
};

/** Key `k` from its PKCS #1 DER. */
const fromDer = (k: InteropKey): Secret<u8[]> | null => {
  const der: u8[] = fromHex(k.pkcs1);
  return rsaParsePrivateKey(der, 0, toI32(der.length));
};

/** Whether `priv` has `k`'s bit length and exponent and `pub`'s modulus. */
const isKey = (priv: Secret<u8[]>, k: InteropKey, pub: RsaPublicKey): boolean =>
  rsaPrivateKeyBits(priv) === toI32(k.bits) &&
  trimmed(rsaPrivateKeyExponent(priv)) === k.e &&
  trimmed(rsaPrivateKeyModulus(priv)) === trimmed(pub.n);

/** `c` signed under `priv`: by the derived salt when `c.derived`, else under `c.salt`. */
const signed = (priv: Secret<u8[]>, c: InteropCase): string =>
  toHex(c.derived ? rsaSignPssSha256(priv, fromHex(c.msg)) : rsaSignPssSha256Salted(priv, fromHex(c.msg), fromHex(c.salt)));

/** Every case under key `index`, signed under both loads and verified under `pub`. */
const casesUnder = (n: Counts, index: i32, der: Secret<u8[]>, pem: Secret<u8[]>, pub: RsaPublicKey, cases: InteropCase[], from: string): void => {
  for (const c of cases) {
    if (toI32(c.key) !== index) {
      continue;
    }
    const sig: string = signed(der, c);
    const ok: boolean = sig === c.sig;
    if (c.derived) {
      n.derived = n.derived + 1;
      n.derivedOk = n.derivedOk + (ok ? 1 : 0);
    } else {
      n.salted = n.salted + 1;
      n.saltedOk = n.saltedOk + (ok ? 1 : 0);
    }
    if (!ok) {
      console.log(`  ${from}: a ${toI32(c.salt.length) / 2}-byte salt over ${toI32(c.msg.length) / 2} bytes gives ${sig.substring(0, 16)}...`);
    }
    if (signed(pem, c) === c.sig) {
      n.pemOk = n.pemOk + 1;
    }
    if (rsaVerifyPss(pub, RSA_HASH_SHA256, toI32(c.salt.length) / 2, fromHex(c.msg), fromHex(c.sig))) {
      n.verified = n.verified + 1;
    }
  }
};

/** Loads each of `keys` both ways, checks each load, and runs its cases; every load is wiped. */
const underKeys = (keys: InteropKey[], cases: InteropCase[]): Counts => {
  const n = new Counts();
  for (let i: i32 = 0; i < toI32(keys.length); i++) {
    const k: InteropKey = keys[i];
    const der: Secret<u8[]> | null = fromDer(k);
    const pem: Secret<u8[]> | null = x509ParseRsaPrivateKey(k.pkcs8);
    const pub: RsaPublicKey | null = rsaParsePublicKey(fromHex(k.pub));
    if (der === null || pem === null || pub === null) {
      console.log(`  ${k.from}: ${der === null ? "the DER" : pem === null ? "the PEM" : "the public key"} does not load`);
      if (der !== null) {
        wipe(der);
      }
      if (pem !== null) {
        wipe(pem);
      }
      continue;
    }
    if (isKey(der, k, pub) && isKey(pem, k, pub)) {
      n.loaded = n.loaded + 1;
    } else {
      console.log(`  ${k.from}: a load has another bit length, exponent or modulus`);
    }
    casesUnder(n, i, der, pem, pub, cases, k.from);
    wipe(der);
    wipe(pem);
  }
  return n;
};

/** How many of `keys` both parsers refuse; a load that succeeds is wiped and named. */
const refusals = (keys: InteropKey[]): i32 => {
  let count: i32 = 0;
  for (const k of keys) {
    const der: Secret<u8[]> | null = fromDer(k);
    const pem: Secret<u8[]> | null = x509ParseRsaPrivateKey(k.pkcs8);
    if (der === null && pem === null) {
      count = count + 1;
    } else {
      console.log(`  ${k.from}: ${der !== null ? "rsaParsePrivateKey" : "x509ParseRsaPrivateKey"} loads it`);
    }
    if (der !== null) {
      wipe(der);
    }
    if (pem !== null) {
      wipe(pem);
    }
  }
  return count;
};

/** The `from` of each of `keys`, joined. */
const names = (keys: InteropKey[]): string => {
  const out: string[] = [];
  for (const k of keys) {
    out.push(k.from);
  }
  return out.join("; ");
};

export const main = (): i32 => {
  const t = new Tally();
  const nk: InteropKey[] = nistKeys();
  const nc: InteropCase[] = nistCases();
  const nist: Counts = underKeys(nk, nc);
  t.check(`each of NIST's ${toI32(nk.length)} keys loads from PKCS #1 DER and from PKCS #8 PEM, each load with its bit length, public exponent and modulus`, nist.loaded === toI32(nk.length));
  t.check(`rsaSignPssSha256Salted gives each of NIST CAVP's ${toI32(nc.length)} FIPS 186-2 SHA-256 signatures, under its 20-byte salt, byte for byte`, nist.salted === toI32(nc.length) && nist.saltedOk === nist.salted);
  t.check("the key loaded from PKCS #8 PEM gives each of them too", nist.salted > 0 && nist.pemOk === nist.salted);
  t.check("each of them verifies under rsaVerifyPss at a salt of 20 bytes", nist.salted > 0 && nist.verified === nist.salted);

  const lk: InteropKey[] = libraryKeys();
  const lc: InteropCase[] = libraryCases();
  const lib: Counts = underKeys(lk, lc);
  const total: i32 = lib.derived + lib.salted;
  t.check(`each of the ${toI32(lk.length)} keys OpenSSL, Go and pyca made (${names(lk)}) loads from the library's PKCS #1 DER and from its PKCS #8 PEM, each load with its bit length, public exponent and modulus`, lib.loaded === toI32(lk.length));
  t.check(`rsaSignPssSha256 gives each of the ${lib.derived} derived-salt signatures byte for byte, each signed by Go where Go loads the key and verified by OpenSSL, pyca and, where it loads the key, Go`, lib.derived > 0 && lib.derivedOk === lib.derived);
  t.check(`rsaSignPssSha256Salted gives each of the ${lib.salted} signatures under a 32-byte salt, the longest salt the key takes or an empty salt byte for byte, Go signing the salted ones where it loads the key and OpenSSL and pyca the empty-salt ones`, lib.salted > 0 && lib.saltedOk === lib.salted);
  t.check("the key loaded from PKCS #8 PEM gives each of them too", total === toI32(lc.length) && lib.pemOk === total);
  t.check("each of them verifies under rsaVerifyPss at its salt length", total > 0 && lib.verified === total);

  const rk: InteropKey[] = refusedKeys();
  t.check(`rsaParsePrivateKey and x509ParseRsaPrivateKey each refuse every one of the ${toI32(rk.length)} keys outside 2048 to 4096 bits or with e of 2^32 or more (${names(rk)})`, refusals(rk) === toI32(rk.length));
  console.log(`rsa sign interop: ${t.passed} passed, ${t.failed} failed, 0 skipped`);
  return t.failed === 0 ? 0 : 1;
};
