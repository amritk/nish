// `nish/crypto/rsa`'s refusals, one check for each rule of the reader and the
// two verifiers: keys built from a fixed seed and signed here (vectors.ts), a
// valid signature beside each broken one, so that a refusal is the rule's and
// not a key or hash that was wrong all along. Removing any one rule fails a
// check below or panics the program. Wycheproof's vectors run in
// `tests/link/crypto_wycheproof_rsa`; docs/security/crypto-rsa.md is the
// audit both pin.
import { Suite } from "nish/testing";
import {
  RSA_HASH_SHA256,
  RSA_HASH_SHA384,
  RSA_HASH_SHA512,
  RSA_MAX_BITS,
  RSA_MIN_BITS,
  RsaPublicKey,
  rsaParsePublicKey,
  rsaVerifyPkcs1v15,
  rsaVerifyPss,
} from "nish/crypto/rsa";
import { fromHex } from "./hex";
import {
  A_PKCS_BT2,
  A_PKCS_FE,
  A_PKCS_GARBAGE,
  A_PKCS_NO_NULL,
  A_PKCS_PLUS_N,
  A_PKCS_SHA256,
  A_PKCS_SHA384,
  A_PKCS_SHA512,
  A_PKCS_WRONG_OID,
  A_PSS_BB,
  A_PSS_PAD,
  A_PSS_SEP,
  A_PSS_SHA256_SALT0,
  A_PSS_SHA256_SALT32,
  A_PSS_SHA384_SALT48,
  A_PSS_SHA512_SALT64,
  A_PSS_TOP,
  A_PSS_ZERO_DB,
  A_SHORT_MSG,
  A_SHORT_SIG,
  B_PKCS,
  B_PSS,
  B_PSS_HIGH,
  C_PKCS,
  D_N,
  D_PKCS,
  E_PSS_SHA512,
  KEY_1023,
  KEY_8192,
  KEY_8193,
  KEY_A,
  KEY_B,
  KEY_C,
  KEY_E,
  KEY_E_BIG,
  KEY_E_EVEN,
  KEY_E_MAX,
  KEY_E_ONE,
  KEY_E_THREE,
  KEY_EVEN_N,
  MSG,
  N_A_INT,
} from "./vectors";

/** Whether the hex DER `hex` reads as a key. */
const parses = (hex: string): boolean => rsaParsePublicKey(fromHex(hex)) !== null;

/** Whether `sig` verifies as PKCS#1 v1.5 under the key `key` and SHA-256 over `MSG`. */
const pkcs = (key: RsaPublicKey | null, sig: string): boolean =>
  key !== null && rsaVerifyPkcs1v15(key, RSA_HASH_SHA256, fromHex(MSG), fromHex(sig));

/** Whether `sig` verifies as PSS under the key `key`, `hash` and a `saltLen`-byte salt, over `MSG`. */
const pss = (key: RsaPublicKey | null, hash: i32, saltLen: i32, sig: string): boolean =>
  key !== null && rsaVerifyPss(key, hash, saltLen, fromHex(MSG), fromHex(sig));

export const runSuite = (): i32 => {
  const t = new Suite("rsa");

  // --- Reading the key ------------------------------------------------------------
  // Key A's DER is `30 82 01 0a`, its modulus INTEGER (N_A_INT, 261 bytes) and
  // `02 03 01 00 01`; each broken key below changes one part of it and fixes
  // the SEQUENCE length to match.
  const keyA: RsaPublicKey | null = rsaParsePublicKey(fromHex(KEY_A));
  t.ok("key A reads", keyA !== null);
  t.ok("key A has 2048 bits", keyA !== null && keyA.bits === 2048);
  t.ok("key A's exponent is 01 00 01", keyA !== null && toI32(keyA.e.length) === 3 && keyA.e[0] === 1 && keyA.e[2] === 1);
  t.ok("key A's modulus has no leading zero", keyA !== null && toI32(keyA.n.length) === 256);
  t.ok("the rebuilt key A reads", parses(`3082010a${N_A_INT}0203010001`));
  t.ok("RSA_MIN_BITS is 1024", RSA_MIN_BITS === 1024);
  t.ok("RSA_MAX_BITS is 8192", RSA_MAX_BITS === 8192);
  t.ok("an outer tag other than SEQUENCE is refused", !parses(`3182010a${N_A_INT}0203010001`));
  t.ok("a length of 81 and less than 0x80 is refused", !parses(`3082010b${N_A_INT}028103010001`));
  t.ok("a length of 82 and less than 0x100 is refused", !parses(`3082010c${N_A_INT}02820003010001`));
  t.ok("a three-octet length is refused", !parses(`308300010a${N_A_INT}0203010001`));
  t.ok("a long-form length octet read as a short one is refused", !parses(`3089${KEY_E.slice(6)}`));
  t.ok("a SEQUENCE length one short is refused", !parses(`30820109${N_A_INT}0203010001`));
  t.ok("a byte after the SEQUENCE is refused", !parses(`${KEY_A}00`));
  t.ok("a byte inside the SEQUENCE after e is refused", !parses(`3082010b${N_A_INT}020301000100`));
  t.ok("a modulus that is not an INTEGER is refused", !parses(`3082010a03${N_A_INT.slice(2)}0203010001`));
  t.ok("an exponent that is not an INTEGER is refused", !parses(`3082010a${N_A_INT}0303010001`));
  t.ok("an empty exponent is refused", !parses(`30820107${N_A_INT}0200`));
  t.ok("a negative modulus is refused", !parses(`30820109${"02820100"}${N_A_INT.slice(10)}0203010001`));
  t.ok("an exponent with a needless leading zero is refused", !parses(`3082010b${N_A_INT}020400010001`));
  t.ok("a modulus with a needless leading zero is refused", !parses(`3082010b028201020000${N_A_INT.slice(10)}0203010001`));
  t.ok("a key one byte short is refused", !parses(KEY_A.slice(0, KEY_A.length - 2)));
  t.ok("an empty key is refused", !parses(""));
  t.ok("an even modulus is refused", !parses(KEY_EVEN_N));
  t.ok("a 1023-bit modulus is refused", !parses(KEY_1023));
  t.ok("a 1024-bit modulus reads", parses(KEY_E));
  t.ok("an 8192-bit modulus reads", parses(KEY_8192));
  t.ok("an 8193-bit modulus is refused", !parses(KEY_8193));
  t.ok("an even exponent is refused", !parses(KEY_E_EVEN));
  t.ok("the exponent 1 is refused", !parses(KEY_E_ONE));
  t.ok("the exponent 3 reads", parses(KEY_E_THREE));
  t.ok("the exponent 2^32 - 1 reads, its leading zero dropped", parses(KEY_E_MAX));
  t.ok("the exponent 2^32 + 1 is refused", !parses(KEY_E_BIG));

  // --- PKCS#1 v1.5 ----------------------------------------------------------------
  const msg: u8[] = fromHex(MSG);
  t.ok("PKCS#1 v1.5 SHA-256 verifies", pkcs(keyA, A_PKCS_SHA256));
  t.ok("PKCS#1 v1.5 SHA-384 verifies", keyA !== null && rsaVerifyPkcs1v15(keyA, RSA_HASH_SHA384, msg, fromHex(A_PKCS_SHA384)));
  t.ok("PKCS#1 v1.5 SHA-512 verifies", keyA !== null && rsaVerifyPkcs1v15(keyA, RSA_HASH_SHA512, msg, fromHex(A_PKCS_SHA512)));
  t.ok("a SHA-256 signature does not verify as SHA-384", !(keyA !== null && rsaVerifyPkcs1v15(keyA, RSA_HASH_SHA384, msg, fromHex(A_PKCS_SHA256))));
  t.ok("another message is refused", !(keyA !== null && rsaVerifyPkcs1v15(keyA, RSA_HASH_SHA256, fromHex("00"), fromHex(A_PKCS_SHA256))));
  t.ok("the hash id 0 is refused", !(keyA !== null && rsaVerifyPkcs1v15(keyA, 0, msg, fromHex(A_PKCS_SHA256))));
  t.ok("the hash id 4 is refused", !(keyA !== null && rsaVerifyPkcs1v15(keyA, 4, msg, fromHex(A_PKCS_SHA256))));
  t.ok("a signature with a zero byte in front is refused", !pkcs(keyA, `00${A_PKCS_SHA256}`));
  t.ok("a signature that starts with a zero byte verifies", keyA !== null && rsaVerifyPkcs1v15(keyA, RSA_HASH_SHA256, fromHex(A_SHORT_MSG), fromHex(A_SHORT_SIG)));
  t.ok("that signature without its zero byte is refused", !(keyA !== null && rsaVerifyPkcs1v15(keyA, RSA_HASH_SHA256, fromHex(A_SHORT_MSG), fromHex(A_SHORT_SIG.slice(2)))));
  t.ok("an empty signature is refused", !pkcs(keyA, ""));
  t.ok("a signature plus n is refused", !pkcs(keyA, A_PKCS_PLUS_N));
  t.ok("a padding byte of FE is refused", !pkcs(keyA, A_PKCS_FE));
  t.ok("block type 02 is refused", !pkcs(keyA, A_PKCS_BT2));
  t.ok("a DigestInfo without NULL parameters is refused", !pkcs(keyA, A_PKCS_NO_NULL));
  t.ok("the SHA-384 OID over a SHA-256 digest is refused", !pkcs(keyA, A_PKCS_WRONG_OID));
  t.ok("bytes after the digest are refused", !pkcs(keyA, A_PKCS_GARBAGE));
  t.ok("PKCS#1 v1.5 verifies under a 2049-bit key", pkcs(rsaParsePublicKey(fromHex(KEY_B)), B_PKCS));
  t.ok("PKCS#1 v1.5 verifies under e = 2^32 - 5", pkcs(rsaParsePublicKey(fromHex(KEY_C)), C_PKCS));
  // Key D is built by hand, below RSA_MIN_BITS: 61 bytes leave room for seven
  // FFs before SHA-256's 51-byte DigestInfo, one short of RFC 8017's eight.
  // D_PKCS is that block, signed: the arithmetic is right, the length is not.
  const keyD: RsaPublicKey = new RsaPublicKey(fromHex(D_N), [1, 0, 1], 488);
  t.ok("a modulus with room for seven FFs is refused", !pkcs(keyD, D_PKCS));

  // --- PSS ------------------------------------------------------------------------
  t.ok("PSS SHA-256 with a 32-byte salt verifies", pss(keyA, RSA_HASH_SHA256, 32, A_PSS_SHA256_SALT32));
  t.ok("PSS SHA-256 with no salt verifies", pss(keyA, RSA_HASH_SHA256, 0, A_PSS_SHA256_SALT0));
  t.ok("PSS SHA-384 with a 48-byte salt verifies", pss(keyA, RSA_HASH_SHA384, 48, A_PSS_SHA384_SALT48));
  t.ok("PSS SHA-512 with a 64-byte salt verifies", pss(keyA, RSA_HASH_SHA512, 64, A_PSS_SHA512_SALT64));
  t.ok("PSS with a salt length one short is refused", !pss(keyA, RSA_HASH_SHA256, 31, A_PSS_SHA256_SALT32));
  t.ok("PSS with a salt length one long is refused", !pss(keyA, RSA_HASH_SHA256, 33, A_PSS_SHA256_SALT32));
  t.ok("PSS under another hash is refused", !pss(keyA, RSA_HASH_SHA384, 32, A_PSS_SHA256_SALT32));
  t.ok("PSS of another message is refused", !(keyA !== null && rsaVerifyPss(keyA, RSA_HASH_SHA256, 32, fromHex("00"), fromHex(A_PSS_SHA256_SALT32))));
  t.ok("PSS with the hash id 0 is refused", !pss(keyA, 0, 32, A_PSS_SHA256_SALT32));
  t.ok("PSS with a salt length of -1 is refused", !pss(keyA, RSA_HASH_SHA256, -1, A_PSS_SHA256_SALT32));
  t.ok("PSS of a block of zeros alone with a salt length of -1 is refused", !pss(keyA, RSA_HASH_SHA256, -1, A_PSS_ZERO_DB));
  t.ok("PSS with a salt length near 2^31 is refused", !pss(keyA, RSA_HASH_SHA256, 0x7ffffff0, A_PSS_SHA256_SALT32));
  t.ok("PSS with a signature a byte long is refused", !pss(keyA, RSA_HASH_SHA256, 32, `00${A_PSS_SHA256_SALT32}`));
  t.ok("PSS ending in bb is refused", !pss(keyA, RSA_HASH_SHA256, 32, A_PSS_BB));
  t.ok("PSS with the masked block's top bit set is refused", !pss(keyA, RSA_HASH_SHA256, 32, A_PSS_TOP));
  t.ok("PSS with a padding byte of 01 is refused", !pss(keyA, RSA_HASH_SHA256, 32, A_PSS_PAD));
  t.ok("PSS with 02 before the salt is refused", !pss(keyA, RSA_HASH_SHA256, 32, A_PSS_SEP));
  const keyB: RsaPublicKey | null = rsaParsePublicKey(fromHex(KEY_B));
  t.ok("PSS verifies under a 2049-bit key", pss(keyB, RSA_HASH_SHA256, 32, B_PSS));
  t.ok("a 2049-bit key's signature of 2^2048 plus a block is refused", !pss(keyB, RSA_HASH_SHA256, 32, B_PSS_HIGH));
  const keyE: RsaPublicKey | null = rsaParsePublicKey(fromHex(KEY_E));
  t.ok("PSS SHA-512 verifies under a 1024-bit key", pss(keyE, RSA_HASH_SHA512, 0, E_PSS_SHA512));
  t.ok("a salt too long for a 1024-bit key and SHA-512 is refused", !pss(keyE, RSA_HASH_SHA512, 100, E_PSS_SHA512));

  return t.done();
};
