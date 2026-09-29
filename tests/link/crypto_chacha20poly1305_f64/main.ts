// `nish/crypto/chacha20poly1305` in a program compiled with `--number-mode f64`,
// where every bare `number` and every unannotated literal is an `f64`. The
// module spells its widths, so its answers must not move: RFC 8439 §2.5.2's
// Poly1305 tag, §2.8.2's AEAD both ways, A.5's decryption, RFC 9001 A.5's
// header mask, and a refusal. `crypto_chacha20poly1305` has the rest, and the
// hex helper both programs share.
import { Suite } from "nish/testing";
import {
  chacha20Poly1305Open,
  chacha20Poly1305Seal,
  chacha20HeaderMask,
  poly1305,
} from "nish/crypto/chacha20poly1305";
import { fromHex, toHex } from "../crypto_chacha20poly1305/hex";

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

  const sunscreen: u8[] = fromHex(
    "4c616469657320616e642047656e746c656d656e206f662074686520636c6173" +
    "73206f66202739393a204966204920636f756c64206f6666657220796f75206f" +
    "6e6c79206f6e652074697020666f7220746865206675747572652c2073756e73" +
    "637265656e20776f756c642062652069742e"
  );
  const aeadKey: u8[] = fromHex("808182838485868788898a8b8c8d8e8f909192939495969798999a9b9c9d9e9f");
  const aeadNonce: u8[] = fromHex("070000004041424344454647");
  const aeadAad: u8[] = fromHex("50515253c0c1c2c3c4c5c6c7");
  const aeadSealed: string =
    "d31a8d34648e60db7b86afbc53ef7ec2a4aded51296e08fea9e2b5a736ee62d6" +
    "3dbea45e8ca9671282fafb69da92728b1a71de0a9e060b2905d6a5b67ecd3b36" +
    "92ddbd7f2d778b8c9803aee328091b58fab324e4fad675945585808b4831d7bc" +
    "3ff4def08e4b7a9de576d26586cec64b61161ae10b594f09e26a7e902ecbd060" +
    "0691";
  t.eqStr("§2.8.2 seal", toHex(chacha20Poly1305Seal(aeadKey, aeadNonce, aeadAad, sunscreen)), aeadSealed);
  t.eqStr("§2.8.2 open", toHex(chacha20Poly1305Open(aeadKey, aeadNonce, aeadAad, fromHex(aeadSealed))), toHex(sunscreen));

  const a5Key: u8[] = fromHex("1c9240a5eb55d38af333888604f6b5f0473917c1402b80099dca5cbc207075c0");
  const a5Nonce: u8[] = fromHex("000000000102030405060708");
  const a5Aad: u8[] = fromHex("f33388860000000000004e91");
  const a5Sealed: u8[] = fromHex(
    "64a0861575861af460f062c79be643bd5e805cfd345cf389f108670ac76c8cb2" +
    "4c6cfc18755d43eea09ee94e382d26b0bdb7b73c321b0100d4f03b7f355894cf" +
    "332f830e710b97ce98c8a84abd0b948114ad176e008d33bd60f982b1ff37c855" +
    "9797a06ef4f0ef61c186324e2b3506383606907b6a7c02b0f9f6157b53c867e4" +
    "b9166c767b804d46a59b5216cde7a4e99040c5a40433225ee282a1b0a06c523e" +
    "af4534d7f83fa1155b0047718cbc546a0d072b04b3564eea1b422273f548271a" +
    "0bb2316053fa76991955ebd63159434ecebb4e466dae5a1073a6727627097a10" +
    "49e617d91d361094fa68f0ff77987130305beaba2eda04df997b714d6c6f2c29" +
    "a6ad5cb4022b02709beead9d67890cbb22392336fea1851f38"
  );
  const a5Plain: string =
    "496e7465726e65742d4472616674732061726520647261667420646f63756d65" +
    "6e74732076616c696420666f722061206d6178696d756d206f6620736978206d" +
    "6f6e74687320616e64206d617920626520757064617465642c207265706c6163" +
    "65642c206f72206f62736f6c65746564206279206f7468657220646f63756d65" +
    "6e747320617420616e792074696d652e20497420697320696e617070726f7072" +
    "6961746520746f2075736520496e7465726e65742d4472616674732061732072" +
    "65666572656e6365206d6174657269616c206f7220746f206369746520746865" +
    "6d206f74686572207468616e206173202fe2809c776f726b20696e2070726f67" +
    "726573732e2fe2809d";
  t.eqStr("A.5 decryption", toHex(chacha20Poly1305Open(a5Key, a5Nonce, a5Aad, a5Sealed)), a5Plain);

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

  const forged: u8[] = fromHex(aeadSealed);
  forged[0] = forged[0] ^ toU8(1);
  t.eqStr("a flipped ciphertext bit answers null", toHex(chacha20Poly1305Open(aeadKey, aeadNonce, aeadAad, forged)), "null");

  return t.done();
};
