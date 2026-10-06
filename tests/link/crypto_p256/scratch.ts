// `p256SignSha256Into` over a `P256SignScratch`: RFC 6979 A.2.5's SHA-256
// signatures byte for byte, the same 64 bytes `p256SignSha256` answers for
// messages of every length from 0 to 199 (each SHA-256 padding case, one and
// two final blocks) under four keys, a message and a signature window inside
// larger arrays, the keys it refuses, and the arena: a signature keeps nothing,
// measured call by call with `Arena.mark()`, the bump address across every
// chunk, as well as `Arena.used()`.
import { Suite } from "nish/testing";
import { Secret, secret, wipe } from "nish:secret";
import { P256SignScratch, P256_SIGNATURE_SIZE, p256SignSha256Into } from "nish/crypto/p256";
import { p256SignSha256Plain as p256SignSha256 } from "./plain";
import { fromHex, toHex } from "./hex";

/** A typed zero, for `--number-mode f64`. */
const ZERO_AT: i32 = 0;

/** `p256SignSha256Into` of all of `msg` on a plain key, into a fresh 64 bytes; `null` when it refuses. */
const signInto = (scratch: P256SignScratch, priv: u8[], msg: u8[]): u8[] | null => {
  const key: Secret<u8[]> = secret(fromHex(toHex(priv)));
  const out: u8[] = new Array<u8>(P256_SIGNATURE_SIZE);
  const ok: boolean = p256SignSha256Into(scratch, key, msg, ZERO_AT, toI32(msg.length), out, ZERO_AT);
  wipe(key);
  return ok ? out : null;
};

/** `count` bytes counting up from `seed`, a message that differs per length. */
const pattern = (count: i32, seed: i32): u8[] => {
  const out: u8[] = new Array<u8>(count);
  for (let i: i32 = 0; i < count && i < toI32(out.length); i++) {
    out[i] = toU8((seed + 7 * i) & 255);
  }
  return out;
};

/** The checks; `priv`, the two signatures and n are the suite's RFC 6979 A.2.5 values. */
export const scratchChecks = (t: Suite, priv: u8[], sampleHex: string, testHex: string, nHex: string): void => {
  const scratch = new P256SignScratch();
  const sample: u8[] = [toU8(115), toU8(97), toU8(109), toU8(112), toU8(108), toU8(101)];
  const test: u8[] = [toU8(116), toU8(101), toU8(115), toU8(116)];

  // --- RFC 6979 A.2.5 ---------------------------------------------------------
  t.eqStr("into scratch: A.2.5 SHA-256 \"sample\": r || s", toHex(signInto(scratch, priv, sample)), sampleHex);
  t.eqStr("into scratch: A.2.5 SHA-256 \"test\": r || s", toHex(signInto(scratch, priv, test)), testHex);
  t.eqStr("and \"sample\" again, in the same scratch", toHex(signInto(scratch, priv, sample)), sampleHex);

  // --- The same signature as p256SignSha256 -----------------------------------
  const keys: u8[][] = [
    priv,
    fromHex("0000000000000000000000000000000000000000000000000000000000000001"),
    fromHex("ffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632550"),
    fromHex("5f1e4a7c0d3b29f8e6a1c7b40e9d2f3a8b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e"),
  ];
  let same: i32 = 0;
  let total: i32 = 0;
  for (let k: i32 = 0; k < toI32(keys.length); k++) {
    for (let len: i32 = 0; len < 200; len++) {
      if (k > 0 && len % 9 !== 0) {
        continue;
      }
      const msg: u8[] = pattern(len, k * 31 + len);
      const priv2: u8[] = keys[k];
      total = total + 1;
      if (toHex(signInto(scratch, priv2, msg)) === toHex(p256SignSha256(priv2, msg))) {
        same = same + 1;
      }
    }
  }
  t.eqI32("the same 64 bytes as p256SignSha256: every length 0 to 199 under A.2.5's key, every ninth under three more", same, total);

  // --- Windows ----------------------------------------------------------------
  // "sample" at buf[5 .. 11), the signature at out[3 .. 67) of 70 bytes.
  const buf: u8[] = pattern(20, 3);
  for (let i: i32 = 0; i < toI32(sample.length); i++) {
    buf[5 + i] = sample[i];
  }
  const out: u8[] = new Array<u8>(70);
  for (let i: i32 = 0; i < 70; i++) {
    out[i] = toU8(0xee);
  }
  const key: Secret<u8[]> = secret(fromHex(toHex(priv)));
  const windowed: boolean = p256SignSha256Into(scratch, key, buf, toI32(5), toI32(6), out, toI32(3));
  const inner: u8[] = new Array<u8>(64);
  for (let i: i32 = 0; i < 64; i++) {
    inner[i] = out[3 + i];
  }
  t.ok("a message window inside a larger array signs as the message alone", windowed && toHex(inner) === sampleHex);
  t.ok(
    "and the bytes around the signature window are untouched",
    toI32(out[0]) === 0xee && toI32(out[2]) === 0xee && toI32(out[67]) === 0xee && toI32(out[69]) === 0xee
  );

  // --- The arena: a signature keeps nothing -----------------------------------
  // Each call measured on its own, so neither this function's scope nor a
  // loop's pass can release what it left: `Arena.mark()` is the bump address
  // in whichever chunk it is, so a call that kept anything, in this chunk or a
  // new one, moves it.
  let moved: i32 = 0;
  let signed: i32 = 0;
  for (let n: i32 = 0; n < 50; n++) {
    const mark: i64 = Arena.mark();
    const used: i64 = Arena.used();
    const ok: boolean = p256SignSha256Into(scratch, key, buf, toI32(5), toI32(6), out, toI32(3));
    if (Arena.mark() !== mark || Arena.used() !== used) {
      moved = moved + 1;
    }
    if (ok) {
      signed = signed + 1;
    }
  }
  wipe(key);
  t.eqI32("fifty signatures after the first, each measured on its own", signed, toI32(50));
  t.eqI32("and not one moved Arena.mark() or Arena.used(): a signature keeps 0 bytes", moved, toI32(0));

  // --- Keys it refuses -------------------------------------------------------
  t.eqStr("private key 0 is refused", toHex(signInto(scratch, new Array<u8>(32), sample)), "null");
  t.eqStr("private key n is refused", toHex(signInto(scratch, fromHex(nHex), sample)), "null");
  t.eqStr("a 31-byte key is refused", toHex(signInto(scratch, new Array<u8>(31), sample)), "null");
  t.eqStr("a 33-byte key is refused", toHex(signInto(scratch, new Array<u8>(33), sample)), "null");
  const untouched: u8[] = new Array<u8>(64);
  const zeroKey: Secret<u8[]> = secret(new Array<u8>(32));
  const refused: boolean = p256SignSha256Into(scratch, zeroKey, sample, ZERO_AT, toI32(6), untouched, ZERO_AT);
  wipe(zeroKey);
  t.ok("and a refused key writes nothing", !refused && toHex(untouched) === toHex(new Array<u8>(64)));
  t.eqStr("the scratch signs again after a refusal", toHex(signInto(scratch, priv, test)), testHex);
};
