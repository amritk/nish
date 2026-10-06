// `aesKeyInto`, the key expansion into an `AesKey` the caller already holds:
// FIPS 197 Appendix C's AES-128 and AES-256 examples through a schedule
// expanded in place, the schedule and H identical word for word to the ones
// `aesKey` makes, an AES-GCM seal the same under both, a hundred expansions
// inside `using a = arena()` leaving `Arena.mark()` where it was, and the
// refusals: a key of neither length, and a schedule array the wrong size for
// the key, each answered `false` with the `AesKey` left as it was.
import { Suite } from "nish/testing";
import { AesKey, aesEncryptBlock, aesGcmSeal, aesKey, aesKeyInto } from "nish/crypto/aes";
import { fromHex, toHex } from "../crypto_aes/hex";

/** Whether `a` and `b` hold the same words, schedule and H alike. */
const sameKey = (a: AesKey, b: AesKey): boolean => {
  if (a.rounds !== b.rounds || a.hHi !== b.hHi || a.hLo !== b.hLo || toI32(a.roundKeys.length) !== toI32(b.roundKeys.length)) {
    return false;
  }
  for (let i: i32 = 0; i < toI32(a.roundKeys.length) && i < toI32(b.roundKeys.length); i++) {
    if (a.roundKeys[i] !== b.roundKeys[i]) {
      return false;
    }
  }
  return true;
};

/** The block `plaintext` encrypted under `key`, as hex, or "null". */
const encrypt = (key: AesKey, plaintext: u8[]): string => {
  const out: u8[] | null = aesEncryptBlock(key, plaintext);
  return out === null ? "null" : toHex(out);
};

/** Runs every check and answers the exit code; `crypto_aes_into_f64` runs them under `--number-mode f64`. */
export const aesIntoChecks = (): i32 => {
  const t = new Suite("aes into");
  const plaintext: u8[] = fromHex("00112233445566778899aabbccddeeff");
  const key128: u8[] = fromHex("000102030405060708090a0b0c0d0e0f");
  const key256: u8[] = fromHex("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f");
  const into128 = new AesKey(toI32(0), new Array<u64>(88));
  const into256 = new AesKey(toI32(0), new Array<u64>(120));

  t.ok("aesKeyInto expands a 16-byte key into an 88-word schedule", aesKeyInto(key128, into128) && into128.rounds === toI32(10));
  t.eqStr("FIPS 197 C.1 (AES-128) under it", encrypt(into128, plaintext), "69c4e0d86a7b0430d8cdb78070b4c55a");
  t.ok("aesKeyInto expands a 32-byte key into a 120-word schedule", aesKeyInto(key256, into256) && into256.rounds === toI32(14));
  t.eqStr("FIPS 197 C.3 (AES-256) under it", encrypt(into256, plaintext), "8ea2b7ca516745bfeafc49904b496089");
  const made128: AesKey | null = aesKey(key128);
  const made256: AesKey | null = aesKey(key256);
  t.ok("the schedule and H are aesKey's, word for word, for both lengths", made128 !== null && made256 !== null && sameKey(made128, into128) && sameKey(made256, into256));
  const iv: u8[] = fromHex("cafebabefacedbaddecaf888");
  const aad: u8[] = fromHex("feedfacedeadbeef");
  const sealed: u8[] | null = aesGcmSeal(into256, iv, aad, plaintext);
  const expected: u8[] | null = made256 === null ? null : aesGcmSeal(made256, iv, aad, plaintext);
  t.ok("an AES-GCM seal under it is the one under aesKey's", sealed !== null && expected !== null && toHex(sealed) === toHex(expected));

  // The same expansion over and over in one arena block, the way a slot installs keys.
  const before: i64 = Arena.mark();
  let expanded: i32 = 0;
  for (let n: i32 = 0; n < 100; n++) {
    using a = arena();
    if (aesKeyInto(key128, into128) && aesKeyInto(key256, into256)) {
      expanded = expanded + 1;
    }
  }
  const after: i64 = Arena.mark();
  t.ok("a hundred expansions of each inside `using a = arena()` leave Arena.mark() where it was", expanded === toI32(100) && after === before);

  // The refusals leave the key as it was.
  t.ok("a 24-byte key is refused", !aesKeyInto(new Array<u8>(24), into128) && made128 !== null && sameKey(made128, into128));
  t.ok("so is an empty one", !aesKeyInto(new Array<u8>(0), into256));
  t.ok("a 16-byte key into a 120-word schedule is refused", !aesKeyInto(key128, into256) && made256 !== null && sameKey(made256, into256));
  t.ok("and a 32-byte key into an 88-word one", !aesKeyInto(key256, into128) && made128 !== null && sameKey(made128, into128));
  return t.done();
};
