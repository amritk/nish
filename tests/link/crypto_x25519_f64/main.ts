// `nish/crypto/x25519` in a program compiled with `--number-mode f64`, where
// every bare `number` and every unannotated literal is an `f64`. The module
// spells its widths, so its answers must not move: RFC 7748 §5.2's first
// vector and §6.1's exchange, a refusal, and every case of Wycheproof's
// x25519_test.json. `crypto_x25519` has the rest, and the hex helper and the
// Wycheproof runner both programs share.
import { Suite } from "nish/testing";
import { x25519, x25519Base } from "nish/crypto/x25519";
import { fromHex, toHex } from "../crypto_x25519/hex";
import { wycheproofX25519 } from "../crypto_x25519/wycheproof";

export const main = (): i32 => {
  const t = new Suite("x25519 (f64 mode)");

  // RFC 7748 §5.2, first vector.
  t.eqStr(
    "§5.2 first vector",
    toHex(
      x25519(
        fromHex("a546e36bf0527c9d3b16154b82465edd62144c0ac1fc5a18506a2244ba449ac4"),
        fromHex("e6db6867583030db3594c1a424b15f7c726624ec26b3353b10a903a6d0ab1c4c")
      )
    ),
    "c3da55379de9c6908e94ea4df28d084f32eccf03491c71f754b4075577a28552"
  );

  // RFC 7748 §6.1.
  const alicePrivate: u8[] = fromHex("77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a");
  const bobPublic: u8[] | null = x25519Base(
    fromHex("5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb")
  );
  t.eqStr("§6.1 Alice's public key", toHex(x25519Base(alicePrivate)), "8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a");
  if (bobPublic !== null) {
    t.eqStr(
      "§6.1 the shared secret",
      toHex(x25519(alicePrivate, bobPublic)),
      "4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742"
    );
  }

  t.eqStr("a 31-byte scalar answers null", toHex(x25519Base(fromHex("00000000000000000000000000000000000000000000000000000000000000"))), "null");

  t.eqI32("wycheproof: every case answers the file's shared secret", wycheproofX25519(t), toI32(0));

  return t.done();
};
