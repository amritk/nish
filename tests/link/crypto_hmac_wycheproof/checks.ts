// Wycheproof's HMAC-SHA-256, -384 and -512 vectors through `nish/crypto/hmac`,
// shared by `crypto_hmac_wycheproof` and `crypto_hmac_wycheproof_f64` so both
// number modes run every case (#476).
//
// Each case's tag is computed in full three ways — the one-shot function, the
// streaming class, and the `Secret`-keyed entry point — and all three must be
// one tag. A case's tag is that tag's leading bytes when the file truncates
// it, so a valid case must match them and an invalid one, a modified tag, must
// not. Every tag also goes through the verifier, which must agree on a
// full-length tag and refuse a truncated one.
import { Suite } from "nish/testing";
import { Secret, secret, wipe } from "nish:secret";
import { timingSafeEqual } from "nish/crypto/ct";
import {
  HmacSha256,
  HmacSha384,
  HmacSha512,
  hmacSha256,
  hmacSha256Secret,
  hmacSha256Verify,
  hmacSha384,
  hmacSha384Secret,
  hmacSha384Verify,
  hmacSha512,
  hmacSha512Secret,
  hmacSha512Verify,
} from "nish/crypto/hmac";
import {
  WycheproofHmacCase,
  wycheproofHmacSha256Cases,
  wycheproofHmacSha384Cases,
  wycheproofHmacSha512Cases,
} from "../crypto_wycheproof/hmac";
import { fromHex } from "../crypto_aes/hex";

/** Which hash a run is over, named by its digest size in bits. */
const SHA256: i32 = 256;
const SHA384: i32 = 384;
const SHA512: i32 = 512;

/** Typed zeros: a bare literal is an `f64` under `--number-mode f64`. */
const FROM: i32 = 0;
const NONE: i32 = 0;

/** The one-shot tag of `msg` under `key`. */
const oneShot = (hash: i32, key: u8[], msg: u8[]): u8[] => {
  if (hash === SHA256) {
    return hmacSha256(key, msg);
  }
  if (hash === SHA384) {
    return hmacSha384(key, msg);
  }
  return hmacSha512(key, msg);
};

/** The same tag through the streaming class, fed one window. */
const streamed = (hash: i32, key: u8[], msg: u8[]): u8[] => {
  const n: i32 = toI32(msg.length);
  if (hash === SHA256) {
    const mac = new HmacSha256(key);
    mac.update(msg, FROM, n);
    return mac.digest();
  }
  if (hash === SHA384) {
    const mac = new HmacSha384(key);
    mac.update(msg, FROM, n);
    return mac.digest();
  }
  const mac = new HmacSha512(key);
  mac.update(msg, FROM, n);
  return mac.digest();
};

/** The same tag under the key held as a `Secret`. */
const sealed = (hash: i32, key: Secret<u8[]>, msg: u8[]): u8[] => {
  if (hash === SHA256) {
    return hmacSha256Secret(key, msg);
  }
  if (hash === SHA384) {
    return hmacSha384Secret(key, msg);
  }
  return hmacSha512Secret(key, msg);
};

/** Whether the verifier accepts `tag`. */
const verified = (hash: i32, key: u8[], msg: u8[], tag: u8[]): boolean => {
  if (hash === SHA256) {
    return hmacSha256Verify(key, msg, tag);
  }
  if (hash === SHA384) {
    return hmacSha384Verify(key, msg, tag);
  }
  return hmacSha512Verify(key, msg, tag);
};

/** The first `n` bytes of `bytes`, fresh; `n` is at most `bytes.length`. */
const leading = (bytes: u8[], n: i32): u8[] => {
  const out: u8[] = new Array<u8>(n);
  for (let i: i32 = 0; i < toI32(out.length) && i < toI32(bytes.length); i += 1) {
    out[i] = bytes[i];
  }
  return out;
};

/**
 * Every case of one file through HMAC over `hash`. A case that disagrees is
 * named by its `tcId`. Answers the number that disagreed.
 */
const runCases = (t: Suite, name: string, hash: i32, cases: WycheproofHmacCase[]): i32 => {
  let matched: i32 = 0;
  let refused: i32 = 0;
  let mismatches: i32 = 0;
  for (const c of cases) {
    const key: u8[] = fromHex(c.key);
    const msg: u8[] = fromHex(c.msg);
    const want: u8[] = fromHex(c.tag);
    const wantLength: i32 = toI32(want.length);
    const full: u8[] = oneShot(hash, key, msg);
    const held: Secret<u8[]> = secret(fromHex(c.key));
    const fromSecret: u8[] = sealed(hash, held, msg);
    wipe(held);
    const oneTag: boolean = timingSafeEqual(full, streamed(hash, key, msg)) && timingSafeEqual(full, fromSecret);
    const agrees: boolean = timingSafeEqual(leading(full, wantLength), want);
    // The verifier takes only a full-length tag, so it must refuse every truncated one.
    const accepted: boolean = verified(hash, key, msg, want);
    const verifierAgrees: boolean = wantLength === toI32(full.length) ? accepted === agrees : !accepted;
    if (!oneTag || !verifierAgrees || agrees !== (c.result === "valid")) {
      t.fail(
        `wycheproof ${name} tcId ${c.tcId}`,
        `the file says ${c.result}; one tag ${oneTag}, matched ${agrees}, verifier agrees ${verifierAgrees}`
      );
      mismatches += 1;
    } else if (agrees) {
      matched += 1;
    } else {
      refused += 1;
    }
  }
  console.log(
    `wycheproof ${name}: ${toI32(cases.length)} cases, ${matched} valid tags matched, ${refused} modified tags refused`
  );
  return mismatches;
};

/** Every case of the three files, in both number modes. Answers `t.done()`. */
export const hmacWycheproofChecks = (): i32 => {
  const t = new Suite("hmac wycheproof");
  t.eqI32(
    "wycheproof HMAC-SHA-256: every case agrees with the file",
    runCases(t, "HMAC-SHA-256", SHA256, wycheproofHmacSha256Cases()),
    NONE
  );
  t.eqI32(
    "wycheproof HMAC-SHA-384: every case agrees with the file",
    runCases(t, "HMAC-SHA-384", SHA384, wycheproofHmacSha384Cases()),
    NONE
  );
  t.eqI32(
    "wycheproof HMAC-SHA-512: every case agrees with the file",
    runCases(t, "HMAC-SHA-512", SHA512, wycheproofHmacSha512Cases()),
    NONE
  );
  return t.done();
};
