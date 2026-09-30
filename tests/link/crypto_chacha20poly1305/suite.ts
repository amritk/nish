// `nish/crypto/chacha20poly1305` against RFC 8439: the quarter round (§2.1.1,
// §2.2.1), the block function (§2.3.2), encryption (§2.4.2), Poly1305
// (§2.5.2), its key generation (§2.6.2) and the AEAD (§2.8.2), then every
// vector of Appendix A — A.1's blocks, A.2's encryptions, A.3's Poly1305 tags
// including the edge cases #5 to #11, A.4's keys and A.5's decryption — and
// RFC 9001 A.5's ChaCha20 header protection. Then the refusals: a flipped bit
// in the tag, the ciphertext and the AAD, every wrong length, and a counter
// that would wrap. Then every case of Wycheproof's chacha20_poly1305_test.json,
// whose edge cases aim at Poly1305's limb arithmetic and final addition, and
// at partial tag checks. Last, tests/cases/ct_asm_chacha20poly1305's copies of the
// Poly1305 cores are held to the module: they must compute the same tags.
//
// The suite is a function rather than `main` so that `crypto_chacha20poly1305_f64` can run
// the same checks with `--number-mode f64`.
import { Suite } from "nish/testing";
import {
  CHACHA20_BLOCK_SIZE,
  CHACHA20_HEADER_MASK_SIZE,
  CHACHA20_HEADER_SAMPLE_SIZE,
  CHACHA20_KEY_SIZE,
  CHACHA20POLY1305_NONCE_SIZE,
  POLY1305_KEY_SIZE,
  POLY1305_TAG_SIZE,
  chacha20,
  chacha20Block,
  chacha20HeaderMask,
  chacha20Poly1305Open,
  chacha20Poly1305Seal,
  chacha20QuarterRound,
  poly1305,
  poly1305KeyGen,
} from "nish/crypto/chacha20poly1305";
import {
  ctChacha20Poly1305TagMatch,
  ctPoly1305Block,
  ctPoly1305Clamp,
  ctPoly1305Finish,
} from "../../cases/ct_asm_chacha20poly1305";
import { fromHex, toHex } from "./hex";
import {
  A5_AAD,
  A5_NONCE,
  A5_PLAIN,
  A5_SEALED,
  AEAD_AAD,
  AEAD_KEY,
  AEAD_NONCE,
  AEAD_SEALED,
  IETF_SUBMISSION,
  JABBERWOCKY,
  KEY_1C92,
  SUNSCREEN,
  SUNSCREEN_CIPHER,
} from "./vectors";
import {
  WYCHEPROOF_CHACHA20_POLY1305_TOTAL,
  WycheproofChaCha20Poly1305Case,
  wycheproofChaCha20Poly1305Cases,
} from "../crypto_wycheproof_aead/chacha20_poly1305";

const WORD_DIGITS: string = "0123456789abcdef";

/** Words as eight hex digits each, space separated, the way RFC 8439 prints a state. */
const wordsHex = (words: u32[] | null): string => {
  if (words === null) {
    return "null";
  }
  const parts: string[] = [];
  for (let i: i32 = 0; i < toI32(words.length); i++) {
    const digits: string[] = [];
    for (let shift: i32 = 28; shift >= 0; shift = shift - 4) {
      const d: i32 = toI32((words[i] >>> toU32(shift)) & 15);
      digits.push(WORD_DIGITS.substring(d, d + 1));
    }
    parts.push(digits.join(""));
  }
  return parts.join(" ");
};

/** A copy of `bytes` with bit `bit` of byte `at` flipped. */
const flip = (bytes: u8[] | null, at: i32, bit: i32): u8[] => {
  const out: u8[] = [];
  if (bytes === null) {
    return out;
  }
  for (let i: i32 = 0; i < toI32(bytes.length); i++) {
    out.push(bytes[i]);
  }
  if (at >= 0 && at < toI32(out.length)) {
    out[at] = out[at] ^ toU8(1 << bit);
  }
  return out;
};

/** `n` zero bytes. */
const zeros = (n: i32): u8[] => new Array<u8>(n);

/** `n` bytes counting up from `start`, wrapping at 256. */
const counting = (n: i32, start: i32): u8[] => {
  const out: u8[] = [];
  for (let i: i32 = 0; i < n; i++) {
    out.push(toU8((start + i) & 255));
  }
  return out;
};

/**
 * Poly1305 on the fixture's copies of the module's cores, padding a short last
 * block as RFC 8439 §2.5.1 does (a 0x01 byte, then zeros, and no 2^128 bit).
 */
const fixtureTag = (key: u8[], msg: u8[]): string => {
  const h: u64[] = new Array<u64>(5);
  const r: u64[] = new Array<u64>(5);
  ctPoly1305Clamp(key, r);
  const len: i32 = toI32(msg.length);
  let at: i32 = 0;
  while (len - at >= 16) {
    ctPoly1305Block(h, r, msg, at, toU64(0x1000000));
    at = at + 16;
  }
  if (at < len) {
    const last: u8[] = new Array<u8>(16);
    for (let i: i32 = 0; at + i < len && i < 16; i++) {
      last[i] = msg[at + i];
    }
    last[len - at] = toU8(1);
    ctPoly1305Block(h, r, last, 0, toU64(0));
  }
  const tag: u8[] = new Array<u8>(16);
  ctPoly1305Finish(h, key, tag);
  return toHex(tag);
};

/**
 * One RFC 8439 A.3 vector, twice: through the module's `poly1305` and through
 * the ct_asm fixture's copies of its cores, which must agree with it.
 */
const tagBoth = (t: Suite, name: string, keyHex: string, msgHex: string, want: string): void => {
  const key: u8[] = fromHex(keyHex);
  const msg: u8[] = fromHex(msgHex);
  t.eqStr(name, toHex(poly1305(key, msg)), want);
  t.eqStr(`${name}, on the ct_asm fixture's copies`, fixtureTag(key, msg), want);
};

/** The fixture's tag compare as a word: all ones for a match, zero otherwise. */
const fixtureMatch = (tag: u8[], sealed: u8[], at: i32): string => {
  const m: u32[] = [ctChacha20Poly1305TagMatch(tag, sealed, at)];
  return wordsHex(m);
};

/**
 * What one Wycheproof case did wrong, or "" when it held: a valid case must
 * seal to exactly `ct || tag` and open back to `msg`, and an invalid one must
 * open to `null` and, when its nonce is the wrong length, seal to `null` too.
 */
const wycheproofProblem = (c: WycheproofChaCha20Poly1305Case): string => {
  const key: u8[] = fromHex(c.key);
  const nonce: u8[] = fromHex(c.iv);
  const aad: u8[] = fromHex(c.aad);
  const sealed: string = `${c.ct}${c.tag}`;
  const opened: string = toHex(chacha20Poly1305Open(key, nonce, aad, fromHex(sealed)));
  const resealed: string = toHex(chacha20Poly1305Seal(key, nonce, aad, fromHex(c.msg)));
  if (!c.valid) {
    if (opened !== "null") {
      return `an invalid case opened to ${opened}`;
    }
    const nonceOk: boolean = toI32(nonce.length) === CHACHA20POLY1305_NONCE_SIZE;
    return nonceOk || resealed === "null" ? "" : `a ${toI32(nonce.length)}-byte nonce sealed to ${resealed}`;
  }
  return opened === c.msg && resealed === sealed ? "" : `opened ${opened}, sealed ${resealed}`;
};

/** Runs every Wycheproof case, failing each that does not hold by its `tcId`, and answers how many failed. */
const wycheproof = (t: Suite, cases: WycheproofChaCha20Poly1305Case[]): i32 => {
  let failed: i32 = 0;
  for (const c of cases) {
    // A pass allocates only garbage once it is judged, so hand it back; a
    // failure is run again outside the mark for the text the suite keeps.
    const mark = Arena.mark();
    const held: boolean = toI32(wycheproofProblem(c).length) === 0;
    Arena.release(mark);
    if (!held) {
      t.fail(`wycheproof tcId ${c.tcId} (${c.comment})`, wycheproofProblem(c));
      failed++;
    }
  }
  return failed;
};

export const runSuite = (): i32 => {
  const t = new Suite("chacha20poly1305");

  t.eqI32("CHACHA20_KEY_SIZE is 32 bytes", CHACHA20_KEY_SIZE, toI32(32));
  t.eqI32("CHACHA20POLY1305_NONCE_SIZE is 12 bytes", CHACHA20POLY1305_NONCE_SIZE, toI32(12));
  t.eqI32("CHACHA20_BLOCK_SIZE is 64 bytes", CHACHA20_BLOCK_SIZE, toI32(64));
  t.eqI32("POLY1305_KEY_SIZE is 32 bytes", POLY1305_KEY_SIZE, toI32(32));
  t.eqI32("POLY1305_TAG_SIZE is 16 bytes", POLY1305_TAG_SIZE, toI32(16));
  t.eqI32("CHACHA20_HEADER_SAMPLE_SIZE is 16 bytes", CHACHA20_HEADER_SAMPLE_SIZE, toI32(16));
  t.eqI32("CHACHA20_HEADER_MASK_SIZE is 5 bytes", CHACHA20_HEADER_MASK_SIZE, toI32(5));

  // --- RFC 8439 §2.1.1 and §2.2.1: the quarter round -------------------------
  const four: u32[] = [0x11111111, 0x01020304, 0x9b8d6f43, 0x01234567];
  t.eqStr(
    "§2.1.1 quarter round",
    wordsHex(chacha20QuarterRound(four, 0, 1, 2, 3)),
    "ea2a92f4 cb1cf8ce 4581472e 5881c4bb"
  );
  t.eqStr("§2.1.1 the input is not changed", wordsHex(four), "11111111 01020304 9b8d6f43 01234567");
  const sample: u32[] = [
    0x879531e0, 0xc5ecf37d, 0x516461b1, 0xc9a62f8a, 0x44c20ef3, 0x3390af7f, 0xd9fc690b, 0x2a5f714c,
    0x53372767, 0xb00a5631, 0x974c541a, 0x359e9963, 0x5c971061, 0x3d631689, 0x2098d9d6, 0x91dbd320,
  ];
  t.eqStr(
    "§2.2.1 QUARTERROUND(2, 7, 8, 13) on a state",
    wordsHex(chacha20QuarterRound(sample, 2, 7, 8, 13)),
    "879531e0 c5ecf37d bdb886dc c9a62f8a 44c20ef3 3390af7f d9fc690b cfacafd2 " +
      "e46bea80 b00a5631 974c541a 359e9963 5c971061 ccc07c79 2098d9d6 91dbd320"
  );
  t.eqStr("a quarter round at position 16 of 16 answers null", wordsHex(chacha20QuarterRound(sample, 2, 7, 8, 16)), "null");
  t.eqStr("a quarter round at position -1 answers null", wordsHex(chacha20QuarterRound(sample, -1, 7, 8, 13)), "null");

  // --- RFC 8439 §2.3.2 and §2.4.2: the block function and encryption ---------
  const key0to31: u8[] = counting(32, 0);
  t.eqStr(
    "§2.3.2 block function",
    toHex(chacha20Block(key0to31, 1, fromHex("000000090000004a00000000"))),
    "10f1e7e4d13b5915500fdd1fa32071c4c7d1f4c733c068030422aa9ac3d46c4e" +
      "d2826446079faa0914c2d705d98b02a2b5129cd1de164eb9cbd083e8a2503c4e"
  );
  const sunscreen: u8[] = fromHex(SUNSCREEN);
  const sunscreenCipher: string = SUNSCREEN_CIPHER;
  t.eqStr("§2.4.2 encryption", toHex(chacha20(key0to31, 1, fromHex("000000000000004a00000000"), sunscreen)), sunscreenCipher);
  t.eqStr(
    "§2.4.2 decryption is the same function",
    toHex(chacha20(key0to31, 1, fromHex("000000000000004a00000000"), fromHex(sunscreenCipher))),
    toHex(sunscreen)
  );

  // --- RFC 8439 §2.5.2 and §2.6.2: Poly1305 and its key ----------------------
  const polyKey252: u8[] = fromHex("85d6be7857556d337f4452fe42d506a80103808afb0db2fd4abff6af4149f51b");
  const forum: u8[] = fromHex("43727970746f6772617068696320466f72756d2052657365617263682047726f" +
    "7570");
  t.eqStr("§2.5.2 Poly1305", toHex(poly1305(polyKey252, forum)), "a8061dc1305136c6c22b8baf0c0127a9");
  t.eqStr(
    "§2.6.2 Poly1305 key generation",
    toHex(poly1305KeyGen(fromHex(AEAD_KEY), fromHex("000000000001020304050607"))),
    "8ad5a08b905f81cc815040274ab29471a833b637e3fd0da508dbb8e2fdd1a646"
  );

  // --- RFC 8439 §2.8.2: the AEAD ---------------------------------------------
  const aeadKey: u8[] = fromHex(AEAD_KEY);
  const aeadNonce: u8[] = fromHex(AEAD_NONCE);
  const aeadAad: u8[] = fromHex(AEAD_AAD);
  const aeadSealed: string = AEAD_SEALED;
  t.eqStr("§2.8.2 seal: the ciphertext and then the tag", toHex(chacha20Poly1305Seal(aeadKey, aeadNonce, aeadAad, sunscreen)), aeadSealed);
  t.eqStr("§2.8.2 open", toHex(chacha20Poly1305Open(aeadKey, aeadNonce, aeadAad, fromHex(aeadSealed))), toHex(sunscreen));

  // --- RFC 8439 A.1: the block function --------------------------------------
  t.eqStr(
    "A.1 test vector #1",
    toHex(chacha20Block(fromHex("0000000000000000000000000000000000000000000000000000000000000000"), 0, fromHex("000000000000000000000000"))),
    "76b8e0ada0f13d90405d6ae55386bd28bdd219b8a08ded1aa836efcc8b770dc7" +
      "da41597c5157488d7724e03fb8d84a376a43b8f41518a11cc387b669b2ee6586"
  );
  t.eqStr(
    "A.1 test vector #2",
    toHex(chacha20Block(fromHex("0000000000000000000000000000000000000000000000000000000000000000"), 1, fromHex("000000000000000000000000"))),
    "9f07e7be5551387a98ba977c732d080dcb0f29a048e3656912c6533e32ee7aed" +
      "29b721769ce64e43d57133b074d839d531ed1f28510afb45ace10a1f4b794d6f"
  );
  t.eqStr(
    "A.1 test vector #3",
    toHex(chacha20Block(fromHex("0000000000000000000000000000000000000000000000000000000000000001"), 1, fromHex("000000000000000000000000"))),
    "3aeb5224ecf849929b9d828db1ced4dd832025e8018b8160b82284f3c949aa5a" +
      "8eca00bbb4a73bdad192b5c42f73f2fd4e273644c8b36125a64addeb006c13a0"
  );
  t.eqStr(
    "A.1 test vector #4",
    toHex(chacha20Block(fromHex("00ff000000000000000000000000000000000000000000000000000000000000"), 2, fromHex("000000000000000000000000"))),
    "72d54dfbf12ec44b362692df94137f328fea8da73990265ec1bbbea1ae9af0ca" +
      "13b25aa26cb4a648cb9b9d1be65b2c0924a66c54d545ec1b7374f4872e99f096"
  );
  t.eqStr(
    "A.1 test vector #5",
    toHex(chacha20Block(fromHex("0000000000000000000000000000000000000000000000000000000000000000"), 0, fromHex("000000000000000000000002"))),
    "c2c64d378cd536374ae204b9ef933fcd1a8b2288b3dfa49672ab765b54ee27c7" +
      "8a970e0e955c14f3a88e741b97c286f75f8fc299e8148362fa198a39531bed6d"
  );

  // --- RFC 8439 A.2: encryption -------------------------------------------------
  t.eqStr(
    "A.2 test vector #1",
    toHex(
      chacha20(
        fromHex("0000000000000000000000000000000000000000000000000000000000000000"),
        0,
        fromHex("000000000000000000000000"),
        fromHex("0000000000000000000000000000000000000000000000000000000000000000" +
          "0000000000000000000000000000000000000000000000000000000000000000")
      )
    ),
    "76b8e0ada0f13d90405d6ae55386bd28bdd219b8a08ded1aa836efcc8b770dc7" +
      "da41597c5157488d7724e03fb8d84a376a43b8f41518a11cc387b669b2ee6586"
  );
  t.eqStr(
    "A.2 test vector #2",
    toHex(
      chacha20(
        fromHex("0000000000000000000000000000000000000000000000000000000000000001"),
        1,
        fromHex("000000000000000000000002"),
        fromHex(IETF_SUBMISSION)
      )
    ),
    "a3fbf07df3fa2fde4f376ca23e82737041605d9f4f4f57bd8cff2c1d4b7955ec" +
      "2a97948bd3722915c8f3d337f7d370050e9e96d647b7c39f56e031ca5eb6250d" +
      "4042e02785ececfa4b4bb5e8ead0440e20b6e8db09d881a7c6132f420e527950" +
      "42bdfa7773d8a9051447b3291ce1411c680465552aa6c405b7764d5e87bea85a" +
      "d00f8449ed8f72d0d662ab052691ca66424bc86d2df80ea41f43abf937d3259d" +
      "c4b2d0dfb48a6c9139ddd7f76966e928e635553ba76c5c879d7b35d49eb2e62b" +
      "0871cdac638939e25e8a1e0ef9d5280fa8ca328b351c3c765989cbcf3daa8b6c" +
      "cc3aaf9f3979c92b3720fc88dc95ed84a1be059c6499b9fda236e7e818b04b0b" +
      "c39c1e876b193bfe5569753f88128cc08aaa9b63d1a16f80ef2554d7189c411f" +
      "5869ca52c5b83fa36ff216b9c1d30062bebcfd2dc5bce0911934fda79a86f6e6" +
      "98ced759c3ff9b6477338f3da4f9cd8514ea9982ccafb341b2384dd902f3d1ab" +
      "7ac61dd29c6f21ba5b862f3730e37cfdc4fd806c22f221"
  );
  t.eqStr(
    "A.2 test vector #3",
    toHex(
      chacha20(
        fromHex(KEY_1C92),
        42,
        fromHex("000000000000000000000002"),
        fromHex(JABBERWOCKY)
      )
    ),
    "62e6347f95ed87a45ffae7426f27a1df5fb69110044c0d73118effa95b01e5cf" +
      "166d3df2d721caf9b21e5fb14c616871fd84c54f9d65b283196c7fe4f60553eb" +
      "f39c6402c42234e32a356b3e764312a61a5532055716ead6962568f87d3f3f77" +
      "04c6a8d1bcd1bf4d50d6154b6da731b187b58dfd728afa36757a797ac188d1"
  );

  // --- RFC 8439 A.3: Poly1305, on the module and on the fixture's copies --------
  tagBoth(
    t,
    "A.3 test vector #1",
    "0000000000000000000000000000000000000000000000000000000000000000",
    "0000000000000000000000000000000000000000000000000000000000000000" +
    "0000000000000000000000000000000000000000000000000000000000000000",
    "00000000000000000000000000000000"
  );
  tagBoth(
    t,
    "A.3 test vector #2",
    "0000000000000000000000000000000036e5f6b5c5e06070f0efca96227a863e",
    IETF_SUBMISSION,
    "36e5f6b5c5e06070f0efca96227a863e"
  );
  tagBoth(
    t,
    "A.3 test vector #3",
    "36e5f6b5c5e06070f0efca96227a863e00000000000000000000000000000000",
    IETF_SUBMISSION,
    "f3477e7cd95417af89a6b8794c310cf0"
  );
  tagBoth(
    t,
    "A.3 test vector #4",
    KEY_1C92,
    JABBERWOCKY,
    "4541669a7eaaee61e708dc7cbcc5eb62"
  );
  tagBoth(
    t,
    "A.3 test vector #5: the partially reduced result is not fully reduced",
    "0200000000000000000000000000000000000000000000000000000000000000",
    "ffffffffffffffffffffffffffffffff",
    "03000000000000000000000000000000"
  );
  tagBoth(
    t,
    "A.3 test vector #6: adding s overflows modulo 2^128",
    "02000000000000000000000000000000ffffffffffffffffffffffffffffffff",
    "02000000000000000000000000000000",
    "03000000000000000000000000000000"
  );
  tagBoth(
    t,
    "A.3 test vector #7: a data limb of all ones with a carry from the limb below",
    "0100000000000000000000000000000000000000000000000000000000000000",
    "fffffffffffffffffffffffffffffffff0ffffffffffffffffffffffffffffff" +
    "11000000000000000000000000000000",
    "05000000000000000000000000000000"
  );
  tagBoth(
    t,
    "A.3 test vector #8: the polynomial part is exactly 2^130 - 5",
    "0100000000000000000000000000000000000000000000000000000000000000",
    "fffffffffffffffffffffffffffffffffbfefefefefefefefefefefefefefefe" +
    "01010101010101010101010101010101",
    "00000000000000000000000000000000"
  );
  tagBoth(
    t,
    "A.3 test vector #9: the polynomial part is exactly 2^130 - 6",
    "0200000000000000000000000000000000000000000000000000000000000000",
    "fdffffffffffffffffffffffffffffff",
    "faffffffffffffffffffffffffffffff"
  );
  tagBoth(
    t,
    "A.3 test vector #10: 5*H+L reduction makes a 131-bit intermediate",
    "0100000000000000040000000000000000000000000000000000000000000000",
    "e33594d7505e43b900000000000000003394d7505e4379cd0100000000000000" +
    "0000000000000000000000000000000001000000000000000000000000000000",
    "14000000000000005500000000000000"
  );
  tagBoth(
    t,
    "A.3 test vector #11: 5*H+L reduction makes a 131-bit final result",
    "0100000000000000040000000000000000000000000000000000000000000000",
    "e33594d7505e43b900000000000000003394d7505e4379cd0100000000000000" +
    "00000000000000000000000000000000",
    "13000000000000000000000000000000"
  );

  // --- RFC 8439 A.4: Poly1305 key generation -----------------------------------
  t.eqStr("A.4 test vector #1", toHex(poly1305KeyGen(fromHex("0000000000000000000000000000000000000000000000000000000000000000"), fromHex("000000000000000000000000"))), "76b8e0ada0f13d90405d6ae55386bd28bdd219b8a08ded1aa836efcc8b770dc7");
  t.eqStr("A.4 test vector #2", toHex(poly1305KeyGen(fromHex("0000000000000000000000000000000000000000000000000000000000000001"), fromHex("000000000000000000000002"))), "ecfa254f845f647473d3cb140da9e87606cb33066c447b87bc2666dde3fbb739");
  t.eqStr("A.4 test vector #3", toHex(poly1305KeyGen(fromHex(KEY_1C92), fromHex("000000000000000000000002"))), "965e3bc6f9ec7ed9560808f4d229f94b137ff275ca9b3fcbdd59deaad23310ae");

  // --- RFC 8439 A.5: AEAD decryption ------------------------------------------
  const a5Key: u8[] = fromHex(KEY_1C92);
  const a5Nonce: u8[] = fromHex(A5_NONCE);
  const a5Aad: u8[] = fromHex(A5_AAD);
  const a5Sealed: u8[] = fromHex(A5_SEALED);
  const a5Plain: string = A5_PLAIN;
  t.eqStr("A.5 decryption", toHex(chacha20Poly1305Open(a5Key, a5Nonce, a5Aad, a5Sealed)), a5Plain);
  t.eqStr("A.5 sealing the plaintext again gives the same message", toHex(chacha20Poly1305Seal(a5Key, a5Nonce, a5Aad, fromHex(a5Plain))), toHex(a5Sealed));

  // --- RFC 9001 A.5: ChaCha20-Poly1305 short header packet ---------------------
  const quicKey: u8[] = fromHex("c6d98ff3441c3fe1b2182094f69caa2ed4b716b65488960a7a984979fb23e1c8");
  const quicHp: u8[] = fromHex("25a282b9e82f06f21f488917a4fc8f1b73573685608597d0efcb076b0ab7a7a4");
  const header: u8[] = fromHex("4200bff4");
  const payload: u8[] | null = chacha20Poly1305Seal(quicKey, fromHex("e0459b3474bdd0e46d417eb0"), header, fromHex("01"));
  t.eqStr("RFC 9001 A.5 payload ciphertext", toHex(payload), "655e5cd55c41f69080575d7999c25a5bfb");
  // The sample starts four bytes after the packet number's first byte, and the
  // packet number here is three bytes long, so it skips one byte of payload.
  const quicSample: u8[] = fromHex("5e5cd55c41f69080575d7999c25a5bfb");
  const mask: u8[] | null = chacha20HeaderMask(quicHp, quicSample);
  t.eqStr("RFC 9001 A.5 mask", toHex(mask), "aefefe7d03");
  if (mask !== null && payload !== null) {
    // RFC 9001 §5.4.1: a short header keeps its top three bits, and the packet
    // number bytes take the mask's next bytes.
    const protectedPacket: u8[] = [];
    protectedPacket.push(header[0] ^ (mask[0] & toU8(0x1f)));
    for (let i: i32 = 1; i < 4 && i < toI32(header.length) && i < toI32(mask.length); i++) {
      protectedPacket.push(header[i] ^ mask[i]);
    }
    for (let i: i32 = 0; i < toI32(payload.length); i++) {
      protectedPacket.push(payload[i]);
    }
    t.eqStr("RFC 9001 A.5 protected packet", toHex(protectedPacket), "4cfe4189655e5cd55c41f69080575d7999c25a5bfb");
  }

  // --- Round trips over every tail length --------------------------------------
  let roundTrips: i32 = 0;
  for (let len: i32 = 0; len <= 130; len++) {
    const plain: u8[] = counting(len, len);
    const aad: u8[] = counting(len % 19, 7);
    const sealed: u8[] | null = chacha20Poly1305Seal(aeadKey, aeadNonce, aad, plain);
    if (sealed !== null && toI32(sealed.length) === len + 16) {
      if (toHex(chacha20Poly1305Open(aeadKey, aeadNonce, aad, sealed)) === toHex(plain)) {
        roundTrips = roundTrips + 1;
      }
    }
  }
  t.eqI32("seal then open gives the plaintext back for every length from 0 to 130", roundTrips, toI32(131));
  const sealedEmpty: u8[] | null = chacha20Poly1305Seal(aeadKey, aeadNonce, aeadAad, zeros(0));
  t.eqI32("an empty plaintext seals to the tag alone", sealedEmpty === null ? toI32(-1) : toI32(sealedEmpty.length), toI32(16));
  if (sealedEmpty !== null) {
    t.eqStr("the tag alone opens to an empty plaintext", toHex(chacha20Poly1305Open(aeadKey, aeadNonce, aeadAad, sealedEmpty)), "");
    t.eqStr("the tag alone with a bit flipped answers null", toHex(chacha20Poly1305Open(aeadKey, aeadNonce, aeadAad, flip(sealedEmpty, 0, 0))), "null");
  }

  // --- Refusals: a message that does not authenticate --------------------------
  const good: u8[] = fromHex(aeadSealed);
  const tagAt: i32 = toI32(good.length) - 16;
  t.eqStr("the last bit of the tag flipped answers null", toHex(chacha20Poly1305Open(aeadKey, aeadNonce, aeadAad, flip(good, tagAt + 15, 7))), "null");
  t.eqStr("the first bit of the tag flipped answers null", toHex(chacha20Poly1305Open(aeadKey, aeadNonce, aeadAad, flip(good, tagAt, 0))), "null");
  t.eqStr("a bit of the ciphertext flipped answers null", toHex(chacha20Poly1305Open(aeadKey, aeadNonce, aeadAad, flip(good, 40, 3))), "null");
  t.eqStr("a bit of the AAD flipped answers null", toHex(chacha20Poly1305Open(aeadKey, aeadNonce, flip(aeadAad, 11, 0), good)), "null");
  t.eqStr("a bit of the nonce flipped answers null", toHex(chacha20Poly1305Open(aeadKey, flip(aeadNonce, 0, 0), aeadAad, good)), "null");
  t.eqStr("a bit of the key flipped answers null", toHex(chacha20Poly1305Open(flip(aeadKey, 31, 7), aeadNonce, aeadAad, good)), "null");
  t.eqStr("the AAD left out answers null", toHex(chacha20Poly1305Open(aeadKey, aeadNonce, zeros(0), good)), "null");
  t.eqStr("a sealed message shorter than a tag answers null", toHex(chacha20Poly1305Open(aeadKey, aeadNonce, aeadAad, zeros(15))), "null");
  t.eqStr("sixteen zero bytes are not the tag of nothing", toHex(chacha20Poly1305Open(aeadKey, aeadNonce, aeadAad, zeros(16))), "null");
  t.eqStr("the tag cut to 12 bytes answers null: only the full tag is accepted", toHex(chacha20Poly1305Open(aeadKey, aeadNonce, aeadAad, fromHex(aeadSealed.substring(0, toI32(aeadSealed.length) - 8)))), "null");

  // --- Refusals: wrong lengths -------------------------------------------------
  t.eqStr("seal with a 31-byte key answers null", toHex(chacha20Poly1305Seal(zeros(31), aeadNonce, aeadAad, sunscreen)), "null");
  t.eqStr("seal with a 33-byte key answers null", toHex(chacha20Poly1305Seal(zeros(33), aeadNonce, aeadAad, sunscreen)), "null");
  t.eqStr("seal with an 11-byte nonce answers null", toHex(chacha20Poly1305Seal(aeadKey, zeros(11), aeadAad, sunscreen)), "null");
  t.eqStr("seal with a 13-byte nonce answers null", toHex(chacha20Poly1305Seal(aeadKey, zeros(13), aeadAad, sunscreen)), "null");
  t.eqStr("open with a 31-byte key answers null", toHex(chacha20Poly1305Open(zeros(31), aeadNonce, aeadAad, good)), "null");
  t.eqStr("open with an 8-byte nonce answers null", toHex(chacha20Poly1305Open(aeadKey, zeros(8), aeadAad, good)), "null");
  t.eqStr("chacha20 with a 16-byte key answers null", toHex(chacha20(zeros(16), 0, zeros(12), sunscreen)), "null");
  t.eqStr("chacha20 with an 8-byte nonce answers null", toHex(chacha20(zeros(32), 0, zeros(8), sunscreen)), "null");
  t.eqStr("chacha20Block with a 31-byte key answers null", toHex(chacha20Block(zeros(31), 0, zeros(12))), "null");
  t.eqStr("chacha20Block with a 13-byte nonce answers null", toHex(chacha20Block(zeros(32), 0, zeros(13))), "null");
  t.eqStr("poly1305 with a 16-byte key answers null", toHex(poly1305(zeros(16), forum)), "null");
  t.eqStr("poly1305KeyGen with a 31-byte key answers null", toHex(poly1305KeyGen(zeros(31), zeros(12))), "null");
  t.eqStr("poly1305KeyGen with an 11-byte nonce answers null", toHex(poly1305KeyGen(zeros(32), zeros(11))), "null");
  t.eqStr("a header mask with a 31-byte key answers null", toHex(chacha20HeaderMask(zeros(31), quicSample)), "null");
  t.eqStr("a header mask from a 15-byte sample answers null", toHex(chacha20HeaderMask(quicHp, zeros(15))), "null");
  t.eqStr("a header mask from a 17-byte sample answers null", toHex(chacha20HeaderMask(quicHp, zeros(17))), "null");

  // --- The 32-bit block counter ------------------------------------------------
  const lastBlock: u8[] | null = chacha20Block(zeros(32), 0xffffffff, zeros(12));
  t.eqStr("counter 2^32 - 1 encrypts one block", toHex(chacha20(zeros(32), 0xffffffff, zeros(12), zeros(64))), toHex(lastBlock));
  t.eqStr("a 65th byte at counter 2^32 - 1 would wrap the counter, and answers null", toHex(chacha20(zeros(32), 0xffffffff, zeros(12), zeros(65))), "null");
  t.eqStr("nothing to encrypt at counter 2^32 - 1 is an empty answer", toHex(chacha20(zeros(32), 0xffffffff, zeros(12), zeros(0))), "");

  // --- Wycheproof --------------------------------------------------------------
  const cases: WycheproofChaCha20Poly1305Case[] = wycheproofChaCha20Poly1305Cases();
  let valid: i32 = 0;
  for (const c of cases) {
    if (c.valid) {
      valid++;
    }
  }
  const ran: i32 = toI32(cases.length);
  const failed: i32 = wycheproof(t, cases);
  t.ok(
    `Wycheproof chacha20_poly1305_test.json: ${ran} of ${WYCHEPROOF_CHACHA20_POLY1305_TOTAL} cases ran (${valid} valid, ${ran - valid} invalid), ${failed} failed`,
    failed === 0 && ran === WYCHEPROOF_CHACHA20_POLY1305_TOTAL
  );

  // --- The fixture's tag compare against the module's answer ------------------
  const expected: u8[] = fromHex("1ae10b594f09e26a7e902ecbd0600691");
  t.eqStr("the fixture's tag compare matches the §2.8.2 tag in place", fixtureMatch(expected, good, tagAt), "ffffffff");
  let mismatches: i32 = 0;
  for (let i: i32 = 0; i < 16; i++) {
    if (fixtureMatch(expected, flip(good, tagAt + i, i & 7), tagAt) === "00000000") {
      mismatches = mismatches + 1;
    }
  }
  t.eqI32("the fixture's tag compare refuses a flipped bit in each of the sixteen bytes", mismatches, toI32(16));

  return t.done();
};
