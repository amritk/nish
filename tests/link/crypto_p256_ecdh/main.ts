// `p256Ecdh`, the P-256 shared secret, through its public surface: the key
// wrapped in a `Secret`, the answer read back through `expose`.
//
// What it runs:
//
// - every case of Wycheproof's ecdh_secp256r1_ecpoint: each "valid" one must
//   answer its published shared secret (tcId 3's is all zeros, an x of 0, and is
//   answered), and the rest refused: the "acceptable" one is a compressed point,
//   which `p256Ecdh` does not take, and each "invalid" one a point off the curve,
//   an empty key, or a compressed point;
// - private keys `p256PublicKey` refuses (0, n, n + 1, 2^256 - 1, 31 and 33
//   bytes) and peer points that are not points (empty, SEC 1's one-byte
//   infinity, 65 zero bytes, the generator with a flipped bit in y, a 0x04
//   point whose x is p): each `null`;
// - both sides of an exchange: for RFC 6979 A.2.5's key and the scalars 1, 2,
//   n - 1 and a random-looking one, a's secret with b's public key must equal
//   b's with a's.
import { Secret, expose, secret, wipe } from "nish:secret";
import { p256Ecdh, p256PublicKey } from "nish/crypto/p256";
import { WycheproofEcdhCase, wycheproofEcdhP256Cases } from "../crypto_wycheproof/ecdh_secp256r1";
import { fromHex, toHex } from "../crypto_p256/hex";

/** A fresh copy of `bytes`: what a `Secret` is made from, and how one is read back. */
const copyOf = (bytes: u8[]): u8[] => {
  const out: u8[] = new Array<u8>(bytes.length);
  for (let i: i32 = 0; i < toI32(out.length) && i < toI32(bytes.length); i++) {
    out[i] = bytes[i];
  }
  return out;
};

/** `p256Ecdh` on a plain key, answering the shared secret's bytes. */
const ecdhPlain = (priv: u8[], peer: u8[]): u8[] | null => {
  const key: Secret<u8[]> = secret(copyOf(priv));
  const shared: Secret<u8[]> | null = p256Ecdh(key, peer);
  wipe(key);
  if (shared === null) {
    return null;
  }
  const out: u8[] = expose(shared, copyOf);
  wipe(shared);
  return out;
};

/** `p256PublicKey` on a plain key. */
const publicPlain = (priv: u8[]): u8[] | null => {
  const key: Secret<u8[]> = secret(copyOf(priv));
  const pub: u8[] | null = p256PublicKey(key);
  wipe(key);
  return pub;
};

/** Wycheproof's private key, 1 to 33 bytes, as the 32 a private key is: left-padded, or its leading 00 dropped. */
const scalarOf = (hex: string): u8[] => {
  const bytes: u8[] = fromHex(hex);
  const out: u8[] = new Array<u8>(32);
  const length: i32 = toI32(bytes.length);
  for (let i: i32 = 0; i < 32; i++) {
    const at: i32 = length - 32 + i;
    out[i] = at >= 0 && at < length ? bytes[at] : 0;
  }
  return out;
};

// RFC 6979 A.2.5's private key, the group order n, the field prime p and G.
const PRIVATE: string = "c9afa9d845ba75166b5c215767b1d6934e50c3db36e89b127b8a622b120f6721";
const N: string = "ffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551";
const N_PLUS_ONE: string = "ffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632552";
const N_MINUS_ONE: string = "ffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632550";
const P: string = "ffffffff00000001000000000000000000000000ffffffffffffffffffffffff";
const G: string =
  "046b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c2964fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5";
const ONES: string = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
const ONE: string = "0000000000000000000000000000000000000000000000000000000000000001";
const TWO: string = "0000000000000000000000000000000000000000000000000000000000000002";
const OTHER: string = "0a0d622a47e48f6bc1038ace438c6f528aa00ad2bd1da5f13ee46bf5f633d71a";

/** Prints `name` and counts it when `ok` is false; answers 1 for a failure, 0 otherwise. */
const check = (name: string, ok: boolean): i32 => {
  if (!ok) {
    console.log(`FAIL ${name}`);
    return 1;
  }
  return 0;
};

/** Every Wycheproof case; answers the failures. */
const wycheproof = (): i32 => {
  const cases: WycheproofEcdhCase[] = wycheproofEcdhP256Cases();
  let failures: i32 = 0;
  let published: i32 = 0;
  let refused: i32 = 0;
  for (let i: i32 = 0; i < toI32(cases.length); i++) {
    const c: WycheproofEcdhCase = cases[i];
    const shared: u8[] | null = ecdhPlain(scalarOf(c.priv), fromHex(c.pub));
    if (c.result === "valid") {
      if (toHex(shared) === c.shared) {
        published = published + 1;
      } else {
        failures = failures + check(`tcId ${c.tcId}: ${toHex(shared)}, want ${c.shared}`, false);
      }
    } else if (shared === null) {
      refused = refused + 1;
    } else {
      failures = failures + check(`tcId ${c.tcId} (${c.result}): a shared secret from a point it should refuse`, false);
    }
  }
  console.log(`wycheproof ecdh: ${published} shared secrets as published, ${refused} public keys refused, of ${cases.length}`);
  return failures;
};

/** Keys and points `p256Ecdh` must refuse; answers the failures. */
const refusals = (): i32 => {
  const g: u8[] = fromHex(G);
  const key: u8[] = fromHex(PRIVATE);
  let failures: i32 = 0;
  failures = failures + check("private key 0", ecdhPlain(new Array<u8>(32), g) === null);
  failures = failures + check("private key n", ecdhPlain(fromHex(N), g) === null);
  failures = failures + check("private key n + 1", ecdhPlain(fromHex(N_PLUS_ONE), g) === null);
  failures = failures + check("private key 2^256 - 1", ecdhPlain(fromHex(ONES), g) === null);
  failures = failures + check("private key of 31 bytes", ecdhPlain(fromHex(PRIVATE.substring(2, 64)), g) === null);
  failures = failures + check("private key of 33 bytes", ecdhPlain(fromHex(`00${PRIVATE}`), g) === null);
  const empty: u8[] = [];
  failures = failures + check("empty point", ecdhPlain(key, empty) === null);
  const infinity: u8[] = [0];
  failures = failures + check("infinity, SEC 1's 0x00", ecdhPlain(key, infinity) === null);
  failures = failures + check("65 zero bytes", ecdhPlain(key, new Array<u8>(65)) === null);
  const off: u8[] = fromHex(G);
  off[64] = toU8(toI32(off[64]) ^ 1);
  failures = failures + check("G with y's low bit flipped", ecdhPlain(key, off) === null);
  failures = failures + check("x = p", ecdhPlain(key, fromHex(`04${P}${G.substring(66, 130)}`)) === null);
  const compressed: u8[] = fromHex(`03${G.substring(2, 66)}`);
  failures = failures + check("G compressed", ecdhPlain(key, compressed) === null);
  console.log("refusals: 12 keys and points checked");
  return failures;
};

/** a's secret with b's public key against b's with a's, for every pair of the scalars; answers the failures. */
const exchanges = (): i32 => {
  const scalars: string[] = [PRIVATE, ONE, TWO, N_MINUS_ONE, OTHER];
  let failures: i32 = 0;
  let agreed: i32 = 0;
  for (let i: i32 = 0; i < toI32(scalars.length); i++) {
    for (let j: i32 = 0; j < toI32(scalars.length); j++) {
      const a: u8[] = fromHex(scalars[i]);
      const b: u8[] = fromHex(scalars[j]);
      const aPub: u8[] | null = publicPlain(a);
      const bPub: u8[] | null = publicPlain(b);
      if (aPub === null || bPub === null) {
        failures = failures + check(`public key of pair ${i}, ${j}`, false);
      } else {
        const ab: u8[] | null = ecdhPlain(a, bPub);
        const ba: u8[] | null = ecdhPlain(b, aPub);
        if (ab !== null && toHex(ab) === toHex(ba)) {
          agreed = agreed + 1;
        } else {
          failures = failures + check(`pair ${i}, ${j}: ${toHex(ab)} against ${toHex(ba)}`, false);
        }
      }
    }
  }
  // 1 with G's public key is G's x.
  const gx: u8[] | null = ecdhPlain(fromHex(ONE), fromHex(G));
  failures = failures + check("1 * G is G's x", toHex(gx) === G.substring(2, 66));
  console.log(`exchanges: ${agreed} of 25 pairs agree both ways`);
  return failures;
};

export const main = (): i32 => {
  const failures: i32 = wycheproof() + refusals() + exchanges();
  console.log(failures === 0 ? "ok" : `${failures} failures`);
  return failures === 0 ? 0 : 1;
};
