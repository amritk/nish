// `nish/crypto/aes` against its specifications: FIPS 197's example
// encryptions (Appendix C.1, C.3), the test cases of the GCM specification
// (McGrew and Viega, "The Galois/Counter Mode of Operation", Appendix B: 1–6
// for AES-128 and 13–18 for AES-256; 7–12 are AES-192, which is not offered),
// its published GHASH intermediates, RFC 9001's header-protection masks
// (Appendix A.2 and A.3), every Wycheproof AES-GCM case with a 128- or
// 256-bit key, and the refusals. Each exported function is exercised here.
import { Suite } from "nish/testing";
import {
  AES_BLOCK,
  AES_GCM_TAG_SIZE,
  AesKey,
  aesBitslicedRound,
  aesEncryptBlock,
  aesGcmOpen,
  aesGcmSeal,
  aesGcmTagMask,
  aesHeaderMask,
  aesKey,
  ghashMultiply,
} from "nish/crypto/aes";
import {
  WYCHEPROOF_AES_GCM_KEY_192,
  WYCHEPROOF_AES_GCM_SHORT_TAG,
  WYCHEPROOF_AES_GCM_TOTAL,
  WycheproofAesGcmCase,
  wycheproofAesGcmCases,
} from "../crypto_wycheproof/aes_gcm";
import {
  aesBitslicedRound as copiedRound,
  aesGcmTagMask as copiedTagMask,
  ghashMultiply as copiedMultiply,
} from "../../cases/ct_asm_aes";
import { fromHex, toHex } from "./hex";

/** The key, or a panic: every key these vectors name is a valid length. */
const keyOf = (hex: string): AesKey => {
  const key: AesKey | null = aesKey(fromHex(hex));
  if (key === null) {
    panic(`no AES key from ${hex}`);
  }
  return key;
};

/** `aesGcmSeal` in hex, or "null". */
const seal = (key: string, iv: string, aad: string, plaintext: string): string =>
  toHex(aesGcmSeal(keyOf(key), fromHex(iv), fromHex(aad), fromHex(plaintext)));

/** `aesGcmOpen` in hex, or "null". */
const open = (key: string, iv: string, aad: string, sealed: string): string =>
  toHex(aesGcmOpen(keyOf(key), fromHex(iv), fromHex(aad), fromHex(sealed)));

/** The bytes of `hex` with bit `bit` of byte `at` flipped, in hex. */
const flip = (hex: string, at: i32, bit: i32): string => {
  const bytes: u8[] = fromHex(hex);
  if (at >= 0 && at < toI32(bytes.length)) {
    bytes[at] = bytes[at] ^ toU8(1 << bit);
  }
  return toHex(bytes);
};

/** Sixteen hex digits as a `u64`. */
const word = (hex: string): u64 => {
  const bytes: u8[] = fromHex(hex);
  let v: u64 = 0;
  for (let i: i32 = 0; i < toI32(bytes.length); i++) {
    v = (v << toU64(8)) | toU64(bytes[i]);
  }
  return v;
};

/** A `u64` as sixteen hex digits. */
const wordHex = (v: u64): string => {
  const bytes: u8[] = new Array<u8>(8);
  for (let i: i32 = 0; i < 8; i++) {
    bytes[i] = toU8((v >> toU64((7 - i) * 8)) & toU64(0xff));
  }
  return toHex(bytes);
};

/** `ghashMultiply` of the block `y` by `h`, both 32 hex digits, in hex. */
const ghash = (y: string, h: string): string => {
  const state: u64[] = [word(y.substring(0, 16)), word(y.substring(16, 32))];
  ghashMultiply(state, word(h.substring(0, 16)), word(h.substring(16, 32)));
  return `${wordHex(state[0])}${wordHex(state[1])}`;
};

/**
 * `aesBitslicedRound` on a state whose 64 bytes all hold `byte`, with a zero
 * round key, answered as the eight planes in hex. A state of one repeated
 * byte is the same in every layout — each plane is all ones or all zeros —
 * and one round maps it to one repeated byte again: SubBytes gives S(byte),
 * ShiftRows moves equal bytes among themselves, and MixColumns leaves a
 * column of four equal bytes as it is, since 2 ⊕ 3 ⊕ 1 ⊕ 1 = 1.
 */
const uniformRound = (byte: i32): string => {
  const q: u64[] = new Array<u64>(8);
  const rk: u64[] = new Array<u64>(16);
  for (let b: i32 = 0; b < 8; b++) {
    q[b] = ((byte >> b) & 1) === 1 ? ~toU64(0) : toU64(0);
  }
  aesBitslicedRound(q, rk, 8);
  const planes: string[] = [];
  for (let b: i32 = 0; b < 8 && b < toI32(q.length); b++) {
    planes.push(q[b] === ~toU64(0) ? "1" : q[b] === toU64(0) ? "0" : "?");
  }
  return planes.join("");
};

/** xorshift64 (Marsaglia, 2003): a fixed stream of test words, not a secret. */
const nextWord = (state: u64[]): u64 => {
  let x: u64 = state[0];
  x = x ^ (x << toU64(13));
  x = x ^ (x >> toU64(7));
  x = x ^ (x << toU64(17));
  state[0] = x;
  return x;
};

/**
 * How many of `rounds` generated inputs on which the disassembly fixture's
 * copies of `aesBitslicedRound`, `ghashMultiply` and `aesGcmTagMask`
 * (tests/cases/ct_asm_aes) answer differently from the module's. The copy is
 * what the assembly check reads and the module is what runs, so this is what
 * keeps the check about the code that ships.
 */
const copiesDisagree = (rounds: i32): i32 => {
  const seed: u64[] = [toU64(0x2545f491) << toU64(32)];
  seed[0] = seed[0] | toU64(0x4f6cdd1d);
  const mine: u64[] = new Array<u64>(8);
  const theirs: u64[] = new Array<u64>(8);
  const rk: u64[] = new Array<u64>(24);
  let differ: i32 = 0;
  for (let n: i32 = 0; n < rounds; n++) {
    for (let i: i32 = 0; i < 8 && i < toI32(mine.length) && i < toI32(theirs.length); i++) {
      mine[i] = nextWord(seed);
      theirs[i] = mine[i];
    }
    for (let i: i32 = 0; i < toI32(rk.length); i++) {
      rk[i] = nextWord(seed);
    }
    const at: i32 = 8 * (n % 3);
    aesBitslicedRound(mine, rk, at);
    copiedRound(theirs, rk, at);
    const hHi: u64 = nextWord(seed);
    const hLo: u64 = nextWord(seed);
    ghashMultiply(mine, hHi, hLo);
    copiedMultiply(theirs, hHi, hLo);
    for (let i: i32 = 0; i < 8 && i < toI32(mine.length) && i < toI32(theirs.length); i++) {
      if (mine[i] !== theirs[i]) {
        differ++;
      }
    }
    // Equal tags on even passes and a one-bit difference on odd ones, so both answers are compared.
    const got: u64 = n % 2 === 0 ? hLo : hLo ^ (toU64(1) << toU64(n % 64));
    if (aesGcmTagMask(hHi, hLo, hHi, got) !== copiedTagMask(hHi, hLo, hHi, got)) {
      differ++;
    }
  }
  return differ;
};

/**
 * What one kept Wycheproof case did wrong, or "" when it held: a valid case
 * must seal to exactly `ct || tag` and open back to `msg`, and an invalid one
 * must open to `null`.
 */
const wycheproofProblem = (c: WycheproofAesGcmCase): string => {
  const key: AesKey | null = aesKey(fromHex(c.key));
  if (key === null) {
    return "no key";
  }
  const sealed: string = `${c.ct}${c.tag}`;
  const opened: string = toHex(aesGcmOpen(key, fromHex(c.iv), fromHex(c.aad), fromHex(sealed)));
  if (!c.valid) {
    return opened === "null" ? "" : `an invalid case opened to ${opened}`;
  }
  const resealed: string = toHex(aesGcmSeal(key, fromHex(c.iv), fromHex(c.aad), fromHex(c.msg)));
  return opened === c.msg && resealed === sealed ? "" : `opened ${opened}, sealed ${resealed}`;
};

/** Runs every kept Wycheproof case, failing each that does not hold by its `tcId`, and answers how many failed. */
const wycheproof = (t: Suite, cases: WycheproofAesGcmCase[]): i32 => {
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

const K0: string = "00000000000000000000000000000000";
const K00: string = "0000000000000000000000000000000000000000000000000000000000000000";
const K: string = "feffe9928665731c6d6a8f9467308308";
const KK: string = "feffe9928665731c6d6a8f9467308308feffe9928665731c6d6a8f9467308308";
const IV0: string = "000000000000000000000000";
const IV: string = "cafebabefacedbaddecaf888";
const IV8: string = "cafebabefacedbad";
const IV60: string =
  "9313225df88406e555909c5aff5269aa6a7a9538534f7da1e4c303d2a318a728c3c0c95156809539fcf0e2429a6b525416aedbf5a0de6a57a637b39b";
const P64: string =
  "d9313225f88406e5a55909c5aff5269a86a7a9531534f7da2e4c303d8a318a721c3c0c95956809532fcf0e2449a6b525b16aedf5aa0de657ba637b391aafd255";
const P60: string =
  "d9313225f88406e5a55909c5aff5269a86a7a9531534f7da2e4c303d8a318a721c3c0c95956809532fcf0e2449a6b525b16aedf5aa0de657ba637b39";
const A: string = "feedfacedeadbeeffeedfacedeadbeefabaddad2";
const C4: string =
  "42831ec2217774244b7221b784d0d49ce3aa212f2c02a4e035c17e2329aca12e21d514b25466931c7d8f6a5aac84aa051ba30b396a0aac973d58e091";
const T4: string = "5bc94fbc3221a5db94fae95ae7121a47";

export const main = (): i32 => {
  const t = new Suite("aes");

  t.eqI32("AES_BLOCK is 16 bytes", AES_BLOCK, 16);
  t.eqI32("AES_GCM_TAG_SIZE is 16 bytes", AES_GCM_TAG_SIZE, 16);

  // --- FIPS 197 Appendix C -------------------------------------------------
  const c1: AesKey = keyOf("000102030405060708090a0b0c0d0e0f");
  const c3: AesKey = keyOf("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f");
  const input: u8[] = fromHex("00112233445566778899aabbccddeeff");
  t.eqStr("FIPS 197 C.1 AES-128", toHex(aesEncryptBlock(c1, input)), "69c4e0d86a7b0430d8cdb78070b4c55a");
  t.eqStr("FIPS 197 C.3 AES-256", toHex(aesEncryptBlock(c3, input)), "8ea2b7ca516745bfeafc49904b496089");
  t.eqStr("aesEncryptBlock leaves its input as it was", toHex(input), "00112233445566778899aabbccddeeff");

  // --- the round on its own -------------------------------------------------
  // S(0x00) = 0x63 and S(0xff) = 0x16, planes listed from bit 0.
  t.eqStr("aesBitslicedRound of all 0x00 is all 0x63", uniformRound(0x00), "11000110");
  t.eqStr("aesBitslicedRound of all 0xff is all 0x16", uniformRound(0xff), "01101000");

  // --- GHASH's multiply, against the GCM specification's intermediates -------
  t.eqStr(
    "ghashMultiply: test case 2's X1 = C1 · H",
    ghash("0388dace60b6a392f328c2b971b2fe78", "66e94bd4ef8a2c3b884cfa59ca342b2e"),
    "5e2ec746917062882c85b0685353deb7"
  );
  t.eqStr(
    "ghashMultiply: test case 2's GHASH = (X1 ⊕ len(A) || len(C)) · H",
    ghash("5e2ec746917062882c85b0685353de37", "66e94bd4ef8a2c3b884cfa59ca342b2e"),
    "f38cbb1ad69223dcc3457ae5b6b0f885"
  );
  t.eqStr(
    "ghashMultiply: test case 3's X1 = C1 · H",
    ghash("42831ec2217774244b7221b784d0d49c", "b83b533708bf535d0aa6e52980d53b78"),
    "59ed3f2bb1a0aaa07c9f56c6a504647b"
  );
  // The field's one is the block whose first bit is set, x^0 in GCM's order.
  t.eqStr(
    "ghashMultiply by one is the identity",
    ghash("0388dace60b6a392f328c2b971b2fe78", "80000000000000000000000000000000"),
    "0388dace60b6a392f328c2b971b2fe78"
  );
  // Every partial product set: the most carries the holes ever have to hold.
  t.eqStr(
    "ghashMultiply of all ones by all ones",
    ghash("ffffffffffffffffffffffffffffffff", "ffffffffffffffffffffffffffffffff"),
    "f402aaaaaaaaaaaaaaaaaaaaaaaaaaaa"
  );

  // --- the disassembly fixture's copies ---------------------------------------
  t.eqI32("tests/cases/ct_asm_aes's copies agree with the module on 1,000 generated inputs", copiesDisagree(1000), 0);

  // --- the tag compare --------------------------------------------------------
  const tagHi: u64 = word("5bc94fbc3221a5db");
  const tagLo: u64 = word("94fae95ae7121a47");
  t.ok("aesGcmTagMask of equal tags is all ones", aesGcmTagMask(tagHi, tagLo, tagHi, tagLo) === ~toU64(0));
  t.ok(
    "aesGcmTagMask is zero for a tag one low bit out",
    aesGcmTagMask(tagHi, tagLo, tagHi, tagLo ^ toU64(1)) === toU64(0)
  );
  t.ok(
    "aesGcmTagMask is zero for a tag one high bit out",
    aesGcmTagMask(tagHi, tagLo, tagHi ^ (toU64(1) << toU64(63)), tagLo) === toU64(0)
  );

  // --- the GCM specification, test cases 1–6 (AES-128) ------------------------
  t.eqStr("GCM test case 1", seal(K0, IV0, "", ""), "58e2fccefa7e3061367f1d57a4e7455a");
  t.eqStr(
    "GCM test case 2",
    seal(K0, IV0, "", K0),
    "0388dace60b6a392f328c2b971b2fe78ab6e47d42cec13bdf53a67b21257bddf"
  );
  t.eqStr(
    "GCM test case 3",
    seal(K, IV, "", P64),
    "42831ec2217774244b7221b784d0d49ce3aa212f2c02a4e035c17e2329aca12e21d514b25466931c7d8f6a5aac84aa051ba30b396a0aac973d58e091473f59854d5c2af327cd64a62cf35abd2ba6fab4"
  );
  t.eqStr("GCM test case 4", seal(K, IV, A, P60), `${C4}${T4}`);
  t.eqStr(
    "GCM test case 5, a 64-bit IV",
    seal(K, IV8, A, P60),
    "61353b4c2806934a777ff51fa22a4755699b2a714fcdc6f83766e5f97b6c742373806900e49f24b22b097544d4896b424989b5e1ebac0f07c23f45983612d2e79e3b0785561be14aaca2fccb"
  );
  t.eqStr(
    "GCM test case 6, a 480-bit IV",
    seal(K, IV60, A, P60),
    "8ce24998625615b603a033aca13fb894be9112a5c3a211a8ba262a3cca7e2ca701e4a9a4fba43c90ccdcb281d48c7c6fd62875d2aca417034c34aee5619cc5aefffe0bfa462af43c1699d050"
  );

  // --- test cases 13–18 (AES-256) ----------------------------------------------
  t.eqStr("GCM test case 13", seal(K00, IV0, "", ""), "530f8afbc74536b9a963b4f1c4cb738b");
  t.eqStr(
    "GCM test case 14",
    seal(K00, IV0, "", K0),
    "cea7403d4d606b6e074ec5d3baf39d18d0d1c8a799996bf0265b98b5d48ab919"
  );
  t.eqStr(
    "GCM test case 15",
    seal(KK, IV, "", P64),
    "522dc1f099567d07f47f37a32a84427d643a8cdcbfe5c0c97598a2bd2555d1aa8cb08e48590dbb3da7b08b1056828838c5f61e6393ba7a0abcc9f662898015adb094dac5d93471bdec1a502270e3cc6c"
  );
  t.eqStr(
    "GCM test case 16",
    seal(KK, IV, A, P60),
    "522dc1f099567d07f47f37a32a84427d643a8cdcbfe5c0c97598a2bd2555d1aa8cb08e48590dbb3da7b08b1056828838c5f61e6393ba7a0abcc9f66276fc6ece0f4e1768cddf8853bb2d551b"
  );
  t.eqStr(
    "GCM test case 17, a 64-bit IV",
    seal(KK, IV8, A, P60),
    "c3762df1ca787d32ae47c13bf19844cbaf1ae14d0b976afac52ff7d79bba9de0feb582d33934a4f0954cc2363bc73f7862ac430e64abe499f47c9b1f3a337dbf46a792c45e454913fe2ea8f2"
  );
  t.eqStr(
    "GCM test case 18, a 480-bit IV",
    seal(KK, IV60, A, P60),
    "5a8def2f0c9e53f1f75d7853659e2a20eeb2b22aafde6419a058ab4f6f746bf40fc0c3b780f244452da3ebf1c5d82cdea2418997200ef82e44ae7e3fa44a8266ee1c8eb0c8b5d4cf5ae9f19a"
  );

  // --- open, the other way round ----------------------------------------------
  t.eqStr("GCM test case 1 opens to nothing", open(K0, IV0, "", "58e2fccefa7e3061367f1d57a4e7455a"), "");
  t.eqStr("GCM test case 4 opens", open(K, IV, A, `${C4}${T4}`), P60);
  t.eqStr(
    "GCM test case 18 opens",
    open(
      KK,
      IV60,
      A,
      "5a8def2f0c9e53f1f75d7853659e2a20eeb2b22aafde6419a058ab4f6f746bf40fc0c3b780f244452da3ebf1c5d82cdea2418997200ef82e44ae7e3fa44a8266ee1c8eb0c8b5d4cf5ae9f19a"
    ),
    P60
  );

  // --- RFC 9001 Appendix A: the Initial packets' header protection ------------
  const clientHp: AesKey = keyOf("9f50449e04a0e810283a1e9933adedd2");
  const serverHp: AesKey = keyOf("c206b8d9b9f0f37644430b490eeaa314");
  t.eqStr(
    "RFC 9001 A.2 client Initial mask",
    toHex(aesHeaderMask(clientHp, fromHex("d1b1c98dd7689fb8ec11d242b123dc9b"))),
    "437b9aec36"
  );
  t.eqStr(
    "RFC 9001 A.3 server Initial mask",
    toHex(aesHeaderMask(serverHp, fromHex("2cd0991cd25b0aac406a5816b6394100"))),
    "2ec0d8356a"
  );

  // --- refusals ----------------------------------------------------------------
  t.eqStr("a 0-byte key answers null", aesKey([]) === null ? "null" : "a key", "null");
  t.eqStr("a 15-byte key answers null", aesKey(fromHex("000102030405060708090a0b0c0d0e")) === null ? "null" : "a key", "null");
  t.eqStr(
    "a 24-byte key answers null: no AES-192",
    aesKey(fromHex("000102030405060708090a0b0c0d0e0f1011121314151617")) === null ? "null" : "a key",
    "null"
  );
  t.eqStr(
    "a 33-byte key answers null",
    aesKey(fromHex("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20")) === null ? "null" : "a key",
    "null"
  );
  t.eqStr("a 15-byte block answers null", toHex(aesEncryptBlock(c1, fromHex("00112233445566778899aabbccddee"))), "null");
  t.eqStr("a 17-byte block answers null", toHex(aesEncryptBlock(c1, fromHex("00112233445566778899aabbccddeeff00"))), "null");
  t.eqStr("a 15-byte sample answers null", toHex(aesHeaderMask(clientHp, fromHex("d1b1c98dd7689fb8ec11d242b123dc"))), "null");
  t.eqStr("seal with an empty IV answers null", seal(K, "", A, P60), "null");
  t.eqStr("open with an empty IV answers null", open(K, "", A, `${C4}${T4}`), "null");
  t.eqStr("open of 15 bytes, shorter than a tag, answers null", open(K, IV, A, "5bc94fbc3221a5db94fae95ae7121a"), "null");
  t.eqStr("a flipped tag bit answers null", open(K, IV, A, `${C4}${flip(T4, 15, 0)}`), "null");
  t.eqStr("a flipped first tag bit answers null", open(K, IV, A, `${C4}${flip(T4, 0, 7)}`), "null");
  t.eqStr("a flipped ciphertext bit answers null", open(K, IV, A, `${flip(C4, 30, 3)}${T4}`), "null");
  t.eqStr("a flipped AAD bit answers null", open(K, IV, flip(A, 19, 0), `${C4}${T4}`), "null");
  t.eqStr("a different IV answers null", open(K, IV8, A, `${C4}${T4}`), "null");
  t.eqStr("the AES-256 key for an AES-128 message answers null", open(KK, IV, A, `${C4}${T4}`), "null");

  // --- Wycheproof ----------------------------------------------------------------
  const cases: WycheproofAesGcmCase[] = wycheproofAesGcmCases();
  let valid: i32 = 0;
  for (const c of cases) {
    if (c.valid) {
      valid++;
    }
  }
  const ran: i32 = toI32(cases.length);
  const failed: i32 = wycheproof(t, cases);
  t.ok(
    `Wycheproof aes_gcm_test.json: ${ran} of ${WYCHEPROOF_AES_GCM_TOTAL} cases ran (${valid} valid, ${ran - valid} invalid), ${failed} failed; filtered out: ${WYCHEPROOF_AES_GCM_KEY_192} with a 192-bit key, ${WYCHEPROOF_AES_GCM_SHORT_TAG} with a tag shorter than 128 bits`,
    failed === 0 && ran + WYCHEPROOF_AES_GCM_KEY_192 + WYCHEPROOF_AES_GCM_SHORT_TAG === WYCHEPROOF_AES_GCM_TOTAL
  );

  return t.done();
};
