// `nish/crypto/ed25519` against RFC 8032: every vector of §7.1 — the public
// key, the signature and its verification — and the refusals §5.1.7 asks for:
// an S of L or more, a public key that is not the canonical encoding of a
// point, an R that is not canonical, and a tampered message, key or
// signature. docs/security/crypto-ecc.md (ECC-5) is the record these pin.
import { Suite } from "nish/testing";
import { ed25519Verify } from "nish/crypto/ed25519";
import { fromHex, toHex } from "../crypto_x25519/hex";
import { copyOf, publicKeyPlain, signPlain } from "./plain";
import { RfcVector, rfcVectors } from "./rfc";

/** `bytes` with byte `at` xored by `mask`. */
const flip = (bytes: u8[], at: i32, mask: i32): u8[] => {
  const out: u8[] = copyOf(bytes);
  if (at >= 0 && at < toI32(out.length)) {
    out[at] = out[at] ^ toU8(mask);
  }
  return out;
};

export const main = (): i32 => {
  const t = new Suite("ed25519");

  // --- RFC 8032 §7.1 -----------------------------------------------------------
  const vectors: RfcVector[] = rfcVectors();
  for (const v of vectors) {
    const seed: u8[] = fromHex(v.seed);
    const msg: u8[] = fromHex(v.msg);
    t.eqStr(`${v.name}: public key`, toHex(publicKeyPlain(seed)), v.pub);
    t.eqStr(`${v.name}: signature`, toHex(signPlain(seed, msg)), v.sig);
    t.ok(`${v.name}: verifies`, ed25519Verify(fromHex(v.pub), msg, fromHex(v.sig)));
  }

  const seed: u8[] = fromHex(vectors[0].seed);
  const pub: u8[] = fromHex(vectors[0].pub);
  const sig: u8[] = fromHex(vectors[0].sig);
  const empty: u8[] = [];

  // Signing reads the seed and leaves it as it was.
  const before: string = toHex(seed);
  signPlain(seed, fromHex("616263"));
  t.eqStr("signing leaves the seed as it was", toHex(seed), before);
  t.eqStr("signing is deterministic", toHex(signPlain(seed, empty)), vectors[0].sig);

  // --- Lengths ----------------------------------------------------------------
  t.eqStr("a 31-byte seed has no public key", toHex(publicKeyPlain(new Array<u8>(31))), "null");
  t.eqStr("a 33-byte seed signs nothing", toHex(signPlain(new Array<u8>(33), empty)), "null");
  t.ok("a 63-byte signature is refused", !ed25519Verify(pub, empty, fromHex(vectors[0].sig.substring(0, 126))));
  t.ok("a 31-byte key is refused", !ed25519Verify(fromHex(vectors[0].pub.substring(0, 62)), empty, sig));

  // --- Tampering --------------------------------------------------------------
  t.ok("a changed message is refused", !ed25519Verify(pub, fromHex("00"), sig));
  t.ok("a flipped bit of R is refused", !ed25519Verify(pub, empty, flip(sig, 0, 1)));
  t.ok("R's sign bit flipped is refused", !ed25519Verify(pub, empty, flip(sig, 31, 0x80)));
  t.ok("a flipped bit of S is refused", !ed25519Verify(pub, empty, flip(sig, 32, 1)));
  t.ok("another key is refused", !ed25519Verify(fromHex(vectors[1].pub), empty, sig));
  t.ok("A's sign bit flipped is refused", !ed25519Verify(flip(pub, 31, 0x80), empty, sig));

  // --- S of L or more (§5.1.7 step 1) ------------------------------------------
  // TEST 1's signature with S + L: the same point equation holds, so only the
  // range check refuses it — the malleability §8.4 warns of.
  t.ok(
    "S + L is refused",
    !ed25519Verify(
      pub,
      empty,
      fromHex(
        "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e06522490155" +
          "4c8c7872aa064e049dbb3013fbf29380d25bf5f0595bbe24655141438e7a101b"
      )
    )
  );
  t.ok(
    "S = L is refused",
    !ed25519Verify(
      pub,
      empty,
      fromHex(
        "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e06522490155" +
          "edd3f55c1a631258d69cf7a2def9de1400000000000000000000000000000010"
      )
    )
  );

  // --- The public key (§5.1.3) -------------------------------------------------
  // y = p + 1 is 1 spelled above p, and y = p is 0: neither is canonical.
  t.ok(
    "a key with y = p + 1 is refused",
    !ed25519Verify(fromHex("eeffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f"), empty, sig)
  );
  t.ok(
    "a key with y = p is refused",
    !ed25519Verify(fromHex("edffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f"), empty, sig)
  );
  // y = 2 has no x on the curve: (y^2 - 1) / (d y^2 + 1) is not a square.
  t.ok(
    "a key with no x on the curve is refused",
    !ed25519Verify(fromHex("0200000000000000000000000000000000000000000000000000000000000000"), empty, sig)
  );
  // y = 1 is the identity, x = 0, so the sign bit may not be set.
  t.ok(
    "x = 0 with the sign bit set is refused",
    !ed25519Verify(fromHex("0100000000000000000000000000000000000000000000000000000000000080"), empty, sig)
  );

  // --- R ----------------------------------------------------------------------
  // A signature made from TEST 1's secret scalar with the nonce r = 0, so R is
  // the identity, encoded canonically: RFC 8032 accepts it. The same S with
  // the identity spelled y = p + 1 is refused, as R is never decoded and the
  // canonical encoding of [S]B - [k]A cannot match it.
  const ab: u8[] = fromHex("6162");
  t.ok(
    "R = the identity, canonical, verifies",
    ed25519Verify(
      pub,
      ab,
      fromHex(
        "0100000000000000000000000000000000000000000000000000000000000000" +
          "5c36be344fcc7277b5af39d483033c2aa6a252c11d108e57f8fcf95760099309"
      )
    )
  );
  t.ok(
    "R = the identity spelled y = p + 1 is refused",
    !ed25519Verify(
      pub,
      ab,
      fromHex(
        "eeffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f" +
          "5c36be344fcc7277b5af39d483033c2aa6a252c11d108e57f8fcf95760099309"
      )
    )
  );

  return t.done();
};
