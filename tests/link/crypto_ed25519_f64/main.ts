// `nish/crypto/ed25519` in a program compiled with `--number-mode f64`, where
// every bare `number` and every unannotated literal is an `f64`. The module
// spells its widths, so its answers must not move: every vector of RFC 8032
// §7.1 and two refusals, an S of L or more and a tampered message.
// `crypto_ed25519` has the rest, and the adapter and vectors both programs
// share.
import { Suite } from "nish/testing";
import { ed25519Verify } from "nish/crypto/ed25519";
import { fromHex, toHex } from "../crypto_x25519/hex";
import { publicKeyPlain, signPlain } from "../crypto_ed25519/plain";
import { RfcVector, rfcVectors } from "../crypto_ed25519/rfc";

export const main = (): i32 => {
  const t = new Suite("ed25519 (f64 mode)");

  const vectors: RfcVector[] = rfcVectors();
  for (const v of vectors) {
    const seed: u8[] = fromHex(v.seed);
    const msg: u8[] = fromHex(v.msg);
    t.eqStr(`${v.name}: public key`, toHex(publicKeyPlain(seed)), v.pub);
    t.eqStr(`${v.name}: signature`, toHex(signPlain(seed, msg)), v.sig);
    t.ok(`${v.name}: verifies`, ed25519Verify(fromHex(v.pub), msg, fromHex(v.sig)));
  }

  // TEST 1's signature with L added to S, and TEST 2's signature on TEST 1's
  // message.
  const v1: RfcVector = vectors[0];
  t.ok(
    "S + L is refused",
    !ed25519Verify(
      fromHex(v1.pub),
      fromHex(v1.msg),
      fromHex(
        "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e06522490155" +
          "4c8c7872aa064e049dbb3013fbf29380d25bf5f0595bbe24655141438e7a101b"
      )
    )
  );
  const v2: RfcVector = vectors[1];
  t.ok("another message is refused", !ed25519Verify(fromHex(v2.pub), fromHex(v1.msg), fromHex(v2.sig)));

  return t.done();
};
