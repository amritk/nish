// `nish/crypto/chacha20poly1305` in a program compiled with `--number-mode f64`,
// where every bare `number` and every unannotated literal is an `f64`. The
// module spells its widths, so its answers must not move: RFC 8439 §2.5.2's
// Poly1305 tag, §2.8.2's AEAD both ways, A.5's decryption, RFC 9001 A.5's
// header mask, and a refusal. `crypto_chacha20poly1305` has the rest, and the
// hex helper and the vectors both programs share.
import { Suite } from "nish/testing";
import {
  chacha20Poly1305Open,
  chacha20Poly1305Seal,
  chacha20HeaderMask,
  poly1305,
} from "nish/crypto/chacha20poly1305";
import { fromHex, toHex } from "../crypto_chacha20poly1305/hex";
import {
  A5_AAD,
  A5_NONCE,
  A5_PLAIN,
  A5_SEALED,
  AEAD_AAD,
  AEAD_KEY,
  AEAD_NONCE,
  AEAD_SEALED,
  KEY_1C92,
  SUNSCREEN,
} from "../crypto_chacha20poly1305/vectors";

export const main = (): i32 => {
  const t = new Suite("chacha20poly1305 (f64 mode)");

  t.eqStr(
    "§2.5.2 Poly1305",
    toHex(
      poly1305(
        fromHex("85d6be7857556d337f4452fe42d506a80103808afb0db2fd4abff6af4149f51b"),
        fromHex("43727970746f6772617068696320466f72756d2052657365617263682047726f7570")
      )
    ),
    "a8061dc1305136c6c22b8baf0c0127a9"
  );

  const aeadKey: u8[] = fromHex(AEAD_KEY);
  const aeadNonce: u8[] = fromHex(AEAD_NONCE);
  const aeadAad: u8[] = fromHex(AEAD_AAD);
  t.eqStr("§2.8.2 seal", toHex(chacha20Poly1305Seal(aeadKey, aeadNonce, aeadAad, fromHex(SUNSCREEN))), AEAD_SEALED);
  t.eqStr("§2.8.2 open", toHex(chacha20Poly1305Open(aeadKey, aeadNonce, aeadAad, fromHex(AEAD_SEALED))), SUNSCREEN);

  t.eqStr(
    "A.5 decryption",
    toHex(chacha20Poly1305Open(fromHex(KEY_1C92), fromHex(A5_NONCE), fromHex(A5_AAD), fromHex(A5_SEALED))),
    A5_PLAIN
  );

  t.eqStr(
    "RFC 9001 A.5 mask",
    toHex(
      chacha20HeaderMask(
        fromHex("25a282b9e82f06f21f488917a4fc8f1b73573685608597d0efcb076b0ab7a7a4"),
        fromHex("5e5cd55c41f69080575d7999c25a5bfb")
      )
    ),
    "aefefe7d03"
  );

  const forged: u8[] = fromHex(AEAD_SEALED);
  forged[0] = forged[0] ^ toU8(1);
  t.eqStr("a flipped ciphertext bit answers null", toHex(chacha20Poly1305Open(aeadKey, aeadNonce, aeadAad, forged)), "null");

  return t.done();
};
