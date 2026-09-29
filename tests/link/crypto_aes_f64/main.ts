// `nish/crypto/aes` in a program compiled with `--number-mode f64`, where
// every bare `number` and every unannotated literal is an `f64`. The module
// spells its widths, so its answers must not move: FIPS 197 C.1 and C.3, the
// GCM specification's test cases 4 and 16 (sealed and opened), 6 and 18 (an IV
// that is hashed), one GHASH multiply, RFC 9001 A.2's mask and a refusal of
// each kind. `crypto_aes` has the rest, and the hex helper both programs share.
import { Suite } from "nish/testing";
import { AesKey, aesEncryptBlock, aesGcmOpen, aesGcmSeal, aesHeaderMask, aesKey, ghashMultiply } from "nish/crypto/aes";
import { fromHex, toHex } from "../crypto_aes/hex";

/** The key, or a panic: every key these vectors name is a valid length. */
const keyOf = (hex: string): AesKey => {
  const key: AesKey | null = aesKey(fromHex(hex));
  if (key === null) {
    panic(`no AES key from ${hex}`);
  }
  return key;
};

const K: string = "feffe9928665731c6d6a8f9467308308";
const KK: string = "feffe9928665731c6d6a8f9467308308feffe9928665731c6d6a8f9467308308";
const IV: string = "cafebabefacedbaddecaf888";
const IV60: string =
  "9313225df88406e555909c5aff5269aa6a7a9538534f7da1e4c303d2a318a728c3c0c95156809539fcf0e2429a6b525416aedbf5a0de6a57a637b39b";
const P60: string =
  "d9313225f88406e5a55909c5aff5269a86a7a9531534f7da2e4c303d8a318a721c3c0c95956809532fcf0e2449a6b525b16aedf5aa0de657ba637b39";
const A: string = "feedfacedeadbeeffeedfacedeadbeefabaddad2";
const SEALED4: string =
  "42831ec2217774244b7221b784d0d49ce3aa212f2c02a4e035c17e2329aca12e21d514b25466931c7d8f6a5aac84aa051ba30b396a0aac973d58e0915bc94fbc3221a5db94fae95ae7121a47";
const SEALED16: string =
  "522dc1f099567d07f47f37a32a84427d643a8cdcbfe5c0c97598a2bd2555d1aa8cb08e48590dbb3da7b08b1056828838c5f61e6393ba7a0abcc9f66276fc6ece0f4e1768cddf8853bb2d551b";

export const main = (): i32 => {
  const t = new Suite("aes (f64 mode)");

  const input: u8[] = fromHex("00112233445566778899aabbccddeeff");
  t.eqStr(
    "FIPS 197 C.1 AES-128",
    toHex(aesEncryptBlock(keyOf("000102030405060708090a0b0c0d0e0f"), input)),
    "69c4e0d86a7b0430d8cdb78070b4c55a"
  );
  t.eqStr(
    "FIPS 197 C.3 AES-256",
    toHex(aesEncryptBlock(keyOf("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f"), input)),
    "8ea2b7ca516745bfeafc49904b496089"
  );

  const k: AesKey = keyOf(K);
  const kk: AesKey = keyOf(KK);
  t.eqStr("GCM test case 4", toHex(aesGcmSeal(k, fromHex(IV), fromHex(A), fromHex(P60))), SEALED4);
  t.eqStr("GCM test case 4 opens", toHex(aesGcmOpen(k, fromHex(IV), fromHex(A), fromHex(SEALED4))), P60);
  t.eqStr(
    "GCM test case 6, a 480-bit IV",
    toHex(aesGcmSeal(k, fromHex(IV60), fromHex(A), fromHex(P60))),
    "8ce24998625615b603a033aca13fb894be9112a5c3a211a8ba262a3cca7e2ca701e4a9a4fba43c90ccdcb281d48c7c6fd62875d2aca417034c34aee5619cc5aefffe0bfa462af43c1699d050"
  );
  t.eqStr("GCM test case 16", toHex(aesGcmSeal(kk, fromHex(IV), fromHex(A), fromHex(P60))), SEALED16);
  t.eqStr("GCM test case 16 opens", toHex(aesGcmOpen(kk, fromHex(IV), fromHex(A), fromHex(SEALED16))), P60);
  t.eqStr(
    "GCM test case 18, a 480-bit IV",
    toHex(aesGcmSeal(kk, fromHex(IV60), fromHex(A), fromHex(P60))),
    "5a8def2f0c9e53f1f75d7853659e2a20eeb2b22aafde6419a058ab4f6f746bf40fc0c3b780f244452da3ebf1c5d82cdea2418997200ef82e44ae7e3fa44a8266ee1c8eb0c8b5d4cf5ae9f19a"
  );

  // The GCM specification's test case 2: X1 = C1 · H.
  const y: u64[] = [
    (toU64(0x0388dace) << toU64(32)) | toU64(0x60b6a392),
    (toU64(0xf328c2b9) << toU64(32)) | toU64(0x71b2fe78),
  ];
  ghashMultiply(y, (toU64(0x66e94bd4) << toU64(32)) | toU64(0xef8a2c3b), (toU64(0x884cfa59) << toU64(32)) | toU64(0xca342b2e));
  t.ok(
    "ghashMultiply: test case 2's X1",
    y[0] === ((toU64(0x5e2ec746) << toU64(32)) | toU64(0x91706288)) &&
      y[1] === ((toU64(0x2c85b068) << toU64(32)) | toU64(0x5353deb7))
  );

  t.eqStr(
    "RFC 9001 A.2 client Initial mask",
    toHex(aesHeaderMask(keyOf("9f50449e04a0e810283a1e9933adedd2"), fromHex("d1b1c98dd7689fb8ec11d242b123dc9b"))),
    "437b9aec36"
  );

  t.ok("a 24-byte key answers null", aesKey(fromHex("000102030405060708090a0b0c0d0e0f1011121314151617")) === null);
  t.eqStr("seal with an empty IV answers null", toHex(aesGcmSeal(k, [], fromHex(A), fromHex(P60))), "null");
  const forged: u8[] = fromHex(SEALED4);
  forged[toI32(forged.length) - 1] = forged[toI32(forged.length) - 1] ^ toU8(1);
  t.eqStr("a flipped tag bit answers null", toHex(aesGcmOpen(k, fromHex(IV), fromHex(A), forged)), "null");

  return t.done();
};
