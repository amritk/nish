// Wycheproof's x25519_test.json through `nish/crypto/x25519`, shared by
// `crypto_x25519` and `crypto_x25519_f64` so both number modes run every case.
import { Suite } from "nish/testing";
import { x25519Plain as x25519 } from "./plain";
import { WycheproofX25519Case, wycheproofX25519Cases } from "../crypto_wycheproof/x25519";
import { fromHex, toHex } from "./hex";

/**
 * Every case of Wycheproof's x25519_test.json through `x25519`, which must
 * answer exactly the file's shared secret. `acceptable` cases are held to it
 * too: each is a public key a protocol may refuse (a low-order point, a
 * non-canonical u, a point on the twist), and RFC 7748 still gives one answer
 * for it, which is what this module promises to compute. A mismatch is named by
 * its `tcId`. Answers the number of mismatches.
 */
export const wycheproofX25519 = (t: Suite): i32 => {
  const cases: WycheproofX25519Case[] = wycheproofX25519Cases();
  let valid: i32 = 0;
  let acceptable: i32 = 0;
  let zero: i32 = 0;
  let mismatches: i32 = 0;
  for (const c of cases) {
    const mark = Arena.mark();
    const shared: string = toHex(x25519(fromHex(c.priv), fromHex(c.pub)));
    if (shared !== c.shared) {
      t.fail(`wycheproof x25519 tcId ${c.tcId}`, `answered ${shared}, the file says ${c.shared}`);
      mismatches += 1;
    } else if (c.result === "valid") {
      valid += 1;
    } else {
      acceptable += 1;
    }
    if (shared === "0000000000000000000000000000000000000000000000000000000000000000") {
      zero += 1;
    }
    Arena.release(mark);
  }
  console.log(
    `wycheproof x25519: ${toI32(cases.length)} cases, ${valid} valid and ${acceptable} acceptable answered the file's shared secret, ${zero} of them all zeros`
  );
  return mismatches;
};
