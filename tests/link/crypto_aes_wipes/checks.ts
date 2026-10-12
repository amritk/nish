// `aesKeyWipe` read back: an AES-128 and an AES-256 key, each made by `aesKey`
// and used to seal, then wiped, and every word of its `roundKeys` — the whole
// array, so the runtime kernels' powers of H after the schedule too on a CPU
// that runs them — and both words of its `h` read back as zero, its `rounds`
// left as it was. A wiped key opens nothing, since its H is zero, and
// `aesKeyInto` installs the key into it again, sealing the same bytes as
// before. `aesKeyInto` refuses an `AesKey` whose `h` is not two words.
//
// The working copies the module and `nish/crypto/chacha20poly1305` wipe inside
// a call (the bitsliced schedule's words and batch, the block H passes
// through, GCTR's keystream batch and E(K, J0)'s block, the ChaCha20 state and keystream, the Poly1305 key and
// accumulators) are dead when the call returns, so no program can read them
// back; `tests/wipes/crypto.js` counts their wipes after `opt -O2` instead,
// compiling this program. What this checks of them is that the answers are
// unchanged: a seal opens to its plaintext under both ciphers, and a forgery
// opens to nothing.
import { Suite } from "nish/testing";
import { AesKey, aesGcmOpen, aesGcmSeal, aesKey, aesKeyInto, aesKeyWipe } from "nish/crypto/aes";
import { chacha20HeaderMask, chacha20Poly1305Open, chacha20Poly1305Seal, poly1305KeyGen } from "nish/crypto/chacha20poly1305";
import { fromHex, toHex } from "../crypto_aes/hex";

/** How many of `words` are not zero. */
const nonZero = (words: u64[]): i32 => {
  let count: i32 = 0;
  for (const w of words) {
    if (w !== toU64(0)) {
      count = count + 1;
    }
  }
  return count;
};

/** `key` sealed and opened again, wiped, read back and reinstalled, as checks named after `name`. */
const wipeKey = (t: Suite, name: string, keyHex: string, words: i32, rounds: i32): void => {
  const zero: i32 = 0;
  const two: i32 = 2;
  const raw: u8[] = fromHex(keyHex);
  const made: AesKey | null = aesKey(raw);
  if (!t.ok(`${name}: aesKey makes the key`, made !== null) || made === null) {
    return;
  }
  const key: AesKey = made;
  const iv: u8[] = fromHex("cafebabefacedbaddecaf888");
  const aad: u8[] = fromHex("feedfacedeadbeefabaddad2");
  const plaintext: u8[] = fromHex("d9313225f88406e5a55909c5aff5269a86a7a9531534f7da2e4c303d8a318a721c3c0c95956809532fcf0e2449a6b525");
  const sealed: string = toHex(aesGcmSeal(key, iv, aad, plaintext));
  t.ok(`${name}: the schedule and H are not zero before the wipe`, nonZero(key.roundKeys) > 0 && nonZero(key.h) > 0);
  aesKeyWipe(key);
  t.eqI32(`${name}: every one of the ${words} round-key words reads zero after aesKeyWipe`, nonZero(key.roundKeys), zero);
  t.eqI32(`${name}: the schedule is still ${words} words`, toI32(key.roundKeys.length), words);
  t.eqI32(`${name}: both words of H read zero`, nonZero(key.h), zero);
  t.eqI32(`${name}: H is still two words`, toI32(key.h.length), two);
  t.eqI32(`${name}: rounds is left as it was`, key.rounds, rounds);
  t.eqStr(`${name}: the wiped key opens nothing`, toHex(aesGcmOpen(key, iv, aad, fromHex(sealed))), "null");
  t.ok(`${name}: aesKeyInto installs the key into the wiped one again`, aesKeyInto(raw, key));
  t.eqStr(`${name}: and it seals what it sealed before`, toHex(aesGcmSeal(key, iv, aad, plaintext)), sealed);
  t.eqStr(`${name}: and opens it`, toHex(aesGcmOpen(key, iv, aad, fromHex(sealed))), toHex(plaintext));
  aesKeyWipe(key);
  t.eqI32(`${name}: a second wipe leaves it zero`, nonZero(key.roundKeys) + nonZero(key.h), zero);
};

/** Runs every check and answers the exit code; `crypto_aes_wipes_f64` runs them under `--number-mode f64`. */
export const aesWipeChecks = (): i32 => {
  const t = new Suite("aes wipes");
  // Typed locals rather than bare literals: a literal can be an `f64` under
  // `--number-mode f64`.
  const l0: i32 = 0;
  const l10: i32 = 10;
  const l14: i32 = 14;
  const l88: i32 = 88;
  const l120: i32 = 120;
  wipeKey(t, "AES-128", "feffe9928665731c6d6a8f9467308308", l88, l10);
  wipeKey(t, "AES-256", "feffe9928665731c6d6a8f9467308308feffe9928665731c6d6a8f9467308308", l120, l14);

  // An `AesKey` whose H is not two words is not one `aesKey` makes.
  const raw: u8[] = fromHex("000102030405060708090a0b0c0d0e0f");
  const odd: AesKey = new AesKey(l0, new Array<u64>(88));
  odd.h = new Array<u64>(3);
  t.ok("aesKeyInto refuses an AesKey whose h is three words", !aesKeyInto(raw, odd));
  t.eqI32("and leaves its schedule as it was", nonZero(odd.roundKeys) + odd.rounds, l0);
  const usable: AesKey | null = aesKey(raw);
  if (usable !== null) {
    usable.h = new Array<u64>(1);
    t.eqStr("a key whose h is one word seals nothing", toHex(aesGcmSeal(usable, fromHex("000000000000000000000000"), [], raw)), "null");
  }

  // ChaCha20-Poly1305 with its per-call state wiped: the answers are the same.
  const key: u8[] = fromHex("808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9f");
  const nonce: u8[] = fromHex("070000004041424344454647");
  const aad: u8[] = fromHex("50515253c0c1c2c3c4c5c6c7");
  const message: u8[] = fromHex("4c616469657320616e642047656e746c656d656e206f662074686520636c617373206f66202739393a");
  const sealed: u8[] | null = chacha20Poly1305Seal(key, nonce, aad, message);
  t.eqStr(
    "RFC 8439 §2.8.2's key, nonce and AAD over the first 41 bytes of its message (checked against Python's cryptography)",
    toHex(sealed),
    "d31a8d34648e60db7b86afbc53ef7ec2a4aded51296e08fea9e2b5a736ee62d63dbea45e8ca9671282c3d3fb9927365d3b7f9b59936e4d3033"
  );
  if (sealed !== null) {
    t.eqStr("it opens to the message", toHex(chacha20Poly1305Open(key, nonce, aad, sealed)), toHex(message));
    const forged: u8[] = fromHex(toHex(sealed));
    forged[0] = forged[0] ^ toU8(1);
    t.eqStr("a forgery opens to nothing", toHex(chacha20Poly1305Open(key, nonce, aad, forged)), "null");
    t.eqStr("and the true one still opens after it", toHex(chacha20Poly1305Open(key, nonce, aad, sealed)), toHex(message));
  }
  t.eqStr(
    "RFC 8439 §2.6.2's Poly1305 key",
    toHex(poly1305KeyGen(fromHex("808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9f"), fromHex("000000000001020304050607"))),
    "8ad5a08b905f81cc815040274ab29471a833b637e3fd0da508dbb8e2fdd1a646"
  );
  t.eqStr(
    "RFC 9001 A.5's ChaCha20 header-protection mask",
    toHex(chacha20HeaderMask(fromHex("25a282b9e82f06f21f488917a4fc8f1b73573685608597d0efcb076b0ab7a7a4"), fromHex("5e5cd55c41f69080575d7999c25a5bfb"))),
    "aefefe7d03"
  );
  return t.done();
};
