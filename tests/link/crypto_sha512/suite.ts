// `nish/crypto/sha512` against its specification. Each vector is cited where it
// is checked: the FIPS 180-4 examples ("abc", the 896-bit message) and the
// one-million-`a` message are the published digests of NIST's examples for
// SHA-384 and SHA-512; the padding-boundary lengths have no published digest,
// so those are checked against an independent implementation (Python's
// `hashlib`), and the pattern that fills them is `(7 * i + 3) & 255`.
//
// The suite is a function rather than `main` so that `crypto_sha512_f64` can run
// the same checks with `--number-mode f64`.
import {
  SHA384_SIZE,
  SHA512_BLOCK,
  SHA512_SIZE,
  Sha384,
  Sha512,
  sha384,
  sha512,
} from "nish/crypto/sha512";
import { Suite } from "nish/testing";

const HEX_DIGITS: string = "0123456789abcdef";

const hex = (bytes: u8[]): string => {
  const digits: string[] = [];
  for (const byte of bytes) {
    const b: i32 = toI32(byte);
    const hi: i32 = b >> 4;
    const lo: i32 = b & 15;
    digits.push(HEX_DIGITS.substring(hi, hi + 1));
    digits.push(HEX_DIGITS.substring(lo, lo + 1));
  }
  return digits.join("");
};

const bytesOf = (text: string): u8[] => {
  const textLen: i32 = toI32(text.length);
  const out = new Array<u8>(textLen);
  const n: i32 = toI32(out.length);
  for (let i: i32 = 0; i < n && i < textLen; i++) {
    out[i] = toU8(text.charCodeAt(i));
  }
  return out;
};

/** `n` bytes of `(7 * i + 3) & 255`: every byte value, and no run a padding bug could hide in. */
const pattern = (n: i32): u8[] => {
  const out = new Array<u8>(n);
  const len: i32 = toI32(out.length);
  for (let i: i32 = 0; i < len; i++) {
    out[i] = toU8((7 * i + 3) & 255);
  }
  return out;
};

const repeated = (byte: u8, n: i32): u8[] => {
  const out = new Array<u8>(n);
  const len: i32 = toI32(out.length);
  for (let i: i32 = 0; i < len; i++) {
    out[i] = byte;
  }
  return out;
};

/** A fresh copy of `buf[off]` .. `buf[off + len - 1]`, to hash a prefix in one shot. */
const window = (buf: u8[], off: i32, len: i32): u8[] => {
  const out = new Array<u8>(len);
  const n: i32 = toI32(out.length);
  for (let i: i32 = 0; i < n; i++) {
    out[i] = buf[off + i];
  }
  return out;
};

const ZERO: i32 = 0;
const ONE: i32 = 1;
const INNER_AT: i32 = 5;

// FIPS 180-4 §5.1.2: the 896-bit, two-block example message.
const MESSAGE_896: string =
  "abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu";

/** Both widths of one message, one-shot, against their expected digests. */
const checkBoth = (t: Suite, label: string, data: u8[], want512: string, want384: string): void => {
  t.eqStr(`sha512 ${label}`, hex(sha512(data)), want512);
  t.eqStr(`sha384 ${label}`, hex(sha384(data)), want384);
};

/** How many ways of cutting `data` in two give a SHA-512 other than the one-shot digest. */
const sha512SplitMisses = (data: u8[]): i32 => {
  const n: i32 = toI32(data.length);
  const want = hex(sha512(data));
  let misses: i32 = 0;
  for (let cut: i32 = 0; cut <= n; cut++) {
    // Each pass's hasher and hex are garbage once compared, so hand them back.
    const mark = Arena.mark();
    const h = new Sha512();
    h.update(data, ZERO, cut);
    h.update(data, cut, n - cut);
    const same = hex(h.digest()) === want;
    Arena.release(mark);
    if (!same) {
      misses++;
    }
  }
  return misses;
};

const sha384SplitMisses = (data: u8[]): i32 => {
  const n: i32 = toI32(data.length);
  const want = hex(sha384(data));
  let misses: i32 = 0;
  for (let cut: i32 = 0; cut <= n; cut++) {
    // Each pass's hasher and hex are garbage once compared, so hand them back.
    const mark = Arena.mark();
    const h = new Sha384();
    h.update(data, ZERO, cut);
    h.update(data, cut, n - cut);
    const same = hex(h.digest()) === want;
    Arena.release(mark);
    if (!same) {
      misses++;
    }
  }
  return misses;
};

export const runSuite = (): i32 => {
  const t = new Suite("sha512");

  t.eqI32("SHA512_SIZE", SHA512_SIZE, toI32(64));
  t.eqI32("SHA384_SIZE", SHA384_SIZE, toI32(48));
  t.eqI32("SHA512_BLOCK", SHA512_BLOCK, toI32(128));
  t.eqI32("a SHA-512 digest is SHA512_SIZE bytes", toI32(sha512(bytesOf("")).length), SHA512_SIZE);
  t.eqI32("a SHA-384 digest is SHA384_SIZE bytes", toI32(sha384(bytesOf("")).length), SHA384_SIZE);

  // The empty message: padding alone fills the one block (FIPS 180-4 §5.1.2).
  checkBoth(
    t,
    "of the empty message",
    bytesOf(""),
    "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e",
    "38b060a751ac96384cd9327eb1b1e36a21fdb71114be07434c0cc7bf63f6e1da274edebfe76f65fbd51ad2f14898b95b"
  );
  // FIPS 180-4 examples, SHA-512 and SHA-384 "One-Block Message Sample": "abc".
  checkBoth(
    t,
    'of "abc"',
    bytesOf("abc"),
    "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f",
    "cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7"
  );
  // FIPS 180-4 examples, "Two-Block Message Sample": the 896-bit message.
  const m896 = bytesOf(MESSAGE_896);
  checkBoth(
    t,
    "of the 896-bit message",
    m896,
    "8e959b75dae313da8cf4f72814fc143f8f7779c6eb9f7fa17299aeadb6889018501d289e4900f7e4331b99dec4b5433ac7d329eeb6dd26545e96e55b874be909",
    "09330c33f71147e83d192fc782cd1b4753111b173b3b05d22fa08086e3b0f712fcc7c71a557e2db966c3e9fa91746039"
  );
  // The long-message example: one million repetitions of "a" (0x61).
  const million = repeated(0x61, 1000000);
  checkBoth(
    t,
    'of one million "a"',
    million,
    "e718483d0ce769644e2e42c7bc15b4638e1f98b13b2044285632a803afa973ebde0ff244877ea60a4cb0432ce577c31beb009c5c2c49aa2e4eadb217ad8cc09b",
    "9d0e1809716474cb086e834e310a4a1ced149e9c00f248527972cec5704c2a5b07b8b3dc38ecc4ebae97ddd87f3d8985"
  );

  // The padding boundaries of §5.1.2: 111 bytes leave room for the 0x80 and the
  // 16-byte length in one block, 112 do not, and 127, 128 and 129 straddle a
  // whole block. Reference digests from Python's hashlib.
  checkBoth(
    t,
    "of 111 bytes",
    pattern(111),
    "68cffa6d0d76f309c9ce0d35280939f8e25990c43b7b086ccdf709be35b07d4ddba599541ff2b1c19d34ea49aeafb9659adb7ac3c0b078bb30a22d57fc6687ef",
    "341388a9dc2275074e90cf394323761919761c805fd9e370977c9966a0e8c81a52135f02577670b0071638a4a26dbc31"
  );
  checkBoth(
    t,
    "of 112 bytes",
    pattern(112),
    "d0865c524d1dddf7c23b799c413f5adcd7caefd3f66a9b49750ec81066012c25a8bcf94ddea6dc525691673097ca40e0101e897fc97218cfdb0704084e2bef4b",
    "619cc5d06138526d70659eccf602d197e63e1050e22039a7feb40a30a5b2b08fb03729e291df12f8c576e6f1cd8af22a"
  );
  checkBoth(
    t,
    "of 127 bytes",
    pattern(127),
    "e0b6a20f1c0c88970a9340152cd5a1c1ecf3d3b8de55102741879438079473540133b812706e5dbec322c8c9523b6fc8c6d16ee626e87ad5fe3d2916afedc369",
    "f8234ab81f5f9641c656680825a9bbb3c2616bcc80b65d5e479a4d96742e1b8742330c9e8256ef5f03caa932487044ca"
  );
  checkBoth(
    t,
    "of 128 bytes",
    pattern(128),
    "99b16f17aa0b969a5b8f08f367719d516e330ccd2660b6f0688ec031dbc783de50a1cd185a2568dba75070a2403d17d4741d163578515dfd2ff756ddfe4d47b1",
    "e8480e9c4dd90f88104a79cbaccec48edbd798a142b4f241d726dc252f1502350e824c7d18dadd59d7d716919fb8f9bf"
  );
  checkBoth(
    t,
    "of 129 bytes",
    pattern(129),
    "a1556e29185778aa5991e34b8884c840d589f0fbb4b8ed590e51e9ac4eb03a008125000db2671f8fe7f485b59a77b518670078ecb41a54b4cd02a7f1d2ca4c6d",
    "430173387764874661acba1e914e50f6d0fbac534809e859b1da4396fad3d5f24c25c6a2d02486d8fbda3994713d981a"
  );

  // Streaming: a message of more than two blocks, cut at every point, and fed a
  // byte at a time, gives the one-shot digest.
  const long = pattern(300);
  const longLen: i32 = toI32(long.length);
  t.eqI32("sha512 of 300 bytes, cut in two at every point", sha512SplitMisses(long), ZERO);
  t.eqI32("sha384 of 300 bytes, cut in two at every point", sha384SplitMisses(long), ZERO);
  const bytewise512 = new Sha512();
  const bytewise384 = new Sha384();
  for (let i: i32 = 0; i < longLen; i++) {
    bytewise512.update(long, i, ONE);
    bytewise384.update(long, i, ONE);
  }
  t.eqStr("sha512 of 300 bytes, one byte at a time", hex(bytewise512.digest()), hex(sha512(long)));
  t.eqStr("sha384 of 300 bytes, one byte at a time", hex(bytewise384.digest()), hex(sha384(long)));

  // One million "a" in 997-byte windows: the buffered path, over many blocks.
  const chunked = new Sha512();
  let at: i32 = 0;
  const millionLen: i32 = toI32(million.length);
  while (at < millionLen) {
    const step: i32 = millionLen - at < 997 ? millionLen - at : 997;
    chunked.update(million, at, step);
    at = at + step;
  }
  t.eqStr(
    'sha512 of one million "a" in 997-byte windows',
    hex(chunked.digest()),
    "e718483d0ce769644e2e42c7bc15b4638e1f98b13b2044285632a803afa973ebde0ff244877ea60a4cb0432ce577c31beb009c5c2c49aa2e4eadb217ad8cc09b"
  );

  // A window that does not start at zero hashes only what it covers.
  const padded = new Array<u8>(toI32(m896.length) + 9);
  for (let i: i32 = 0; i < toI32(m896.length); i++) {
    padded[i + INNER_AT] = m896[i];
  }
  const inner = new Sha384();
  inner.update(padded, INNER_AT, toI32(m896.length));
  t.eqStr("sha384 of a window at offset 5", hex(inner.digest()), hex(sha384(m896)));

  // copy(): a copy taken mid-stream digests the prefix, updating the copy leaves
  // the original alone, and the original's final digest is unchanged.
  const half: i32 = 150;
  const main512 = new Sha512();
  main512.update(long, ZERO, half);
  const prefix512 = main512.copy();
  const fork512 = main512.copy();
  fork512.update(m896, ZERO, toI32(m896.length));
  t.eqStr("Sha512.copy digests the prefix", hex(prefix512.digest()), hex(sha512(window(long, 0, half))));
  main512.update(long, half, longLen - half);
  t.eqStr("Sha512.copy leaves the original's digest unchanged", hex(main512.digest()), hex(sha512(long)));
  const forked = window(long, 0, half);
  for (let i: i32 = 0; i < toI32(m896.length); i++) {
    forked.push(m896[i]);
  }
  t.eqStr("Sha512.copy is updated on its own", hex(fork512.digest()), hex(sha512(forked)));

  const main384 = new Sha384();
  main384.update(long, ZERO, half);
  const prefix384 = main384.copy();
  const fork384 = main384.copy();
  fork384.update(m896, ZERO, toI32(m896.length));
  t.eqStr("Sha384.copy digests the prefix", hex(prefix384.digest()), hex(sha384(window(long, 0, half))));
  main384.update(long, half, longLen - half);
  t.eqStr("Sha384.copy leaves the original's digest unchanged", hex(main384.digest()), hex(sha384(long)));
  t.eqStr("Sha384.copy is updated on its own", hex(fork384.digest()), hex(sha384(forked)));

  return t.done();
};
