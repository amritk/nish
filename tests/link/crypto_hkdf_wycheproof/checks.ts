// Wycheproof's HKDF-SHA-256 and HKDF-SHA-384 vectors through
// `nish/crypto/hkdf`, shared by `crypto_hkdf_wycheproof` and
// `crypto_hkdf_wycheproof_f64` so both number modes run every case (#476).
//
// Each case is derived three ways — `extract` then `expand`, the `*Into`
// functions over an `HkdfScratch`, and `hkdfSha256Secret` on the IKM held as
// a `Secret` — and all three must give the file's output. Every invalid case
// asks for one byte past 255 × HashLen, which each way must refuse.
import { Suite } from "nish/testing";
import { Secret, exposeWith, secret, wipe } from "nish:secret";
import { timingSafeEqual } from "nish/crypto/ct";
import {
  HkdfScratch,
  hkdfExpandInto,
  hkdfExpandSha256,
  hkdfExpandSha384,
  hkdfExtractInto,
  hkdfExtractSha256,
  hkdfExtractSha384,
  hkdfSha256Secret,
  hkdfSha384Secret,
} from "nish/crypto/hkdf";
import { WycheproofHkdfCase, wycheproofHkdfSha256Cases, wycheproofHkdfSha384Cases } from "../crypto_wycheproof/hkdf";
import { fromHex } from "../crypto_aes/hex";

/** HashLen of each hash, which is also how the `*Into` functions name it. */
const SHA256_LEN: i32 = 32;
const SHA384_LEN: i32 = 48;

/** Typed zeros: a bare literal is an `f64` under `--number-mode f64`. */
const AT: i32 = 0;
const NONE: i32 = 0;

/** `extract` then `expand`, or `null` where `expand` refuses. */
const twoSteps = (hashLength: i32, salt: u8[], ikm: u8[], info: u8[], size: i32): u8[] | null => {
  if (hashLength === SHA256_LEN) {
    return hkdfExpandSha256(hkdfExtractSha256(salt, ikm), info, size);
  }
  return hkdfExpandSha384(hkdfExtractSha384(salt, ikm), info, size);
};

/** The same through the scratch, or `null` where `hkdfExpandInto` refuses. */
const scratched = (s: HkdfScratch, hashLength: i32, salt: u8[], ikm: u8[], info: u8[], size: i32): u8[] | null => {
  const prk: u8[] = new Array<u8>(hashLength);
  hkdfExtractInto(s, hashLength, salt, ikm, prk, AT);
  const out: u8[] = new Array<u8>(size < 0 ? NONE : size);
  if (!hkdfExpandInto(s, hashLength, prk, info, out, AT, size)) {
    return null;
  }
  return out;
};

/** Whether the bytes a `Secret` holds are `want`, for `exposeWith` to run. */
const holds = (value: u8[], want: u8[]): boolean => timingSafeEqual(value, want);

/**
 * Whether `hkdfSha256Secret` (or `384`) on the IKM held as a `Secret` gives
 * `want`, or refuses when `want` is `null`.
 */
const sealedAgrees = (hashLength: i32, salt: u8[], ikmHex: string, info: u8[], size: i32, want: u8[] | null): boolean => {
  const ikm: Secret<u8[]> = secret(fromHex(ikmHex));
  const okm: Secret<u8[]> | null =
    hashLength === SHA256_LEN ? hkdfSha256Secret(salt, ikm, info, size) : hkdfSha384Secret(salt, ikm, info, size);
  wipe(ikm);
  if (okm === null) {
    return want === null;
  }
  const same: boolean = want !== null && exposeWith(okm, want, holds);
  wipe(okm);
  return same;
};

/** Whether `got` is `want`, both possibly `null`. */
const sameOrBothNull = (got: u8[] | null, want: u8[] | null): boolean => {
  if (got === null || want === null) {
    return got === null && want === null;
  }
  return timingSafeEqual(got, want);
};

/**
 * Every case of one file through HKDF over the hash of `hashLength` bytes. A
 * case that disagrees is named by its `tcId`. Answers the number that
 * disagreed.
 */
const runCases = (t: Suite, name: string, hashLength: i32, cases: WycheproofHkdfCase[]): i32 => {
  const s = new HkdfScratch();
  let derived: i32 = 0;
  let refused: i32 = 0;
  let mismatches: i32 = 0;
  for (const c of cases) {
    const salt: u8[] = fromHex(c.salt);
    const ikm: u8[] = fromHex(c.ikm);
    const info: u8[] = fromHex(c.info);
    const size: i32 = toI32(c.size);
    const want: u8[] | null = c.result === "valid" ? fromHex(c.okm) : null;
    const plain: boolean = sameOrBothNull(twoSteps(hashLength, salt, ikm, info, size), want);
    const viaScratch: boolean = sameOrBothNull(scratched(s, hashLength, salt, ikm, info, size), want);
    const viaSecret: boolean = sealedAgrees(hashLength, salt, c.ikm, info, size, want);
    if (!plain || !viaScratch || !viaSecret) {
      t.fail(
        `wycheproof ${name} tcId ${c.tcId}`,
        `the file says ${c.result}; extract and expand ${plain}, scratch ${viaScratch}, secret ${viaSecret}`
      );
      mismatches += 1;
    } else if (want === null) {
      refused += 1;
    } else {
      derived += 1;
    }
  }
  console.log(
    `wycheproof ${name}: ${toI32(cases.length)} cases, ${derived} derived the file's output, ${refused} oversized lengths refused`
  );
  return mismatches;
};

/** Every case of the two files. Answers `t.done()`. */
export const hkdfWycheproofChecks = (): i32 => {
  const t = new Suite("hkdf wycheproof");
  t.eqI32(
    "wycheproof HKDF-SHA-256: every case agrees with the file",
    runCases(t, "HKDF-SHA-256", SHA256_LEN, wycheproofHkdfSha256Cases()),
    NONE
  );
  t.eqI32(
    "wycheproof HKDF-SHA-384: every case agrees with the file",
    runCases(t, "HKDF-SHA-384", SHA384_LEN, wycheproofHkdfSha384Cases()),
    NONE
  );
  return t.done();
};
