// `nish/crypto/bcrypt` against crypt_blowfish's own test vectors (the `tests`
// table in its wrapper.c) and against `$2b$` hashes libxcrypt's `crypt_r`
// made on the same inputs. Every vector here was re-run through libxcrypt
// before it was written down; the `$2x$` ones, which the module refuses, are
// kept to show the refusal. `tests/differential/bcrypt.js` checks random
// passwords and salts against `crypt_r` on top of these.
//
// The groups: the reference's vectors, the `$2a$` sign-extension
// countermeasure and the 8-bit bytes behind it, the 72-byte cut and the
// terminating NUL, what `bcryptHash` makes for a salt and cost, and every way
// a salt, a cost or a hash string is refused.
import { Suite } from "nish/testing";
import { Secret, secret, wipe } from "nish:secret";
import { bcryptHash, bcryptVerify } from "nish/crypto/bcrypt";
import { fromHex } from "../crypto_aes/hex";
import { copyOf } from "../crypto_x25519/plain";

/** The bytes of an ASCII string. */
const bytesOf = (text: string): u8[] => {
  const out: u8[] = [];
  const n: i32 = toI32(text.length);
  for (let i: i32 = 0; i < n; i += 1) {
    out.push(toU8(text.charCodeAt(i)));
  }
  return out;
};

/** The bytes `hex` spells, `times` times over. */
const cycled = (hex: string, times: i32): u8[] => {
  const unit: u8[] = fromHex(hex);
  const out: u8[] = [];
  for (let k: i32 = 0; k < times; k += 1) {
    for (const b of unit) {
      out.push(b);
    }
  }
  return out;
};

/** `a` followed by `b`. */
const joined = (a: u8[], b: u8[]): u8[] => {
  const out: u8[] = copyOf(a);
  for (const x of b) {
    out.push(x);
  }
  return out;
};

/** What `bcryptHash` makes of `password`, or its error spelled `Err: …`. */
const hashOf = (password: u8[], salt: u8[], cost: i32): string => {
  const held: Secret<u8[]> = secret(copyOf(password));
  const made: Result<string, string> = bcryptHash(held, salt, cost);
  wipe(held);
  if (made.isErr()) {
    return `Err: ${made.error}`;
  }
  return made.value;
};

/** What `bcryptVerify` answers for `password` and `hash`: `true`, `false` or `Err: …`. */
const verifyOf = (password: u8[], hash: string): string => {
  const held: Secret<u8[]> = secret(copyOf(password));
  const answer: Result<boolean, string> = bcryptVerify(held, hash);
  wipe(held);
  if (answer.isErr()) {
    return `Err: ${answer.error}`;
  }
  return answer.value ? "true" : "false";
};

/** Runs every check and answers the exit code; `crypto_bcrypt_f64` runs them under `--number-mode f64`. */
export const bcryptChecks = (): i32 => {
  const t = new Suite("bcrypt");
  // Typed locals rather than bare literals: a literal can be an `f64` under
  // `--number-mode f64`.
  const c3: i32 = 3;
  const c4: i32 = 4;
  const c5: i32 = 5;
  const c6: i32 = 6;
  const c32: i32 = 32;
  const n24: i32 = 24;
  const n36: i32 = 36;
  const n72: i32 = 72;
  const n200: i32 = 200;
  const saltC: u8[] = joined(cycled("104104", c5), fromHex("10"));
  const saltOK: u8[] = fromHex("05030085d5ed4c176b2ac3cbee47291c");
  const saltAbc: u8[] = fromHex("71d79f8218a39259a7a29aabb2dbafc3");
  const saltZero: u8[] = cycled("00", 16);
  const digits72: u8[] = bytesOf("0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789");
  const empty: u8[] = [];

  // --- crypt_blowfish's wrapper.c vectors ---------------------------------
  t.eqStr("U*U", verifyOf(bytesOf("U*U"), "$2a$05$CCCCCCCCCCCCCCCCCCCCC.E5YPO9kmyuRGyh0XouQYb4YMJKvyOeW"), "true");
  t.eqStr("U*U*", verifyOf(bytesOf("U*U*"), "$2a$05$CCCCCCCCCCCCCCCCCCCCC.VGOzA784oUp/Z0DY336zx7pLYAy0lwK"), "true");
  t.eqStr("U*U*U", verifyOf(bytesOf("U*U*U"), "$2a$05$XXXXXXXXXXXXXXXXXXXXXOAcXxm9kjPGEMsLznoKqmqw7tc8WCx4a"), "true");
  t.eqStr("a key past 72 bytes: the rest is ignored", verifyOf(joined(digits72, bytesOf("chars after 72 are ignored")), "$2a$05$abcdefghijklmnopqrstuu5s2v8.iXieOjg/.AySBTTZIIVFJeBui"), "true");
  t.eqStr("$2y$ \\xff\\xff\\xa3", verifyOf(fromHex("ffffa3"), "$2y$05$/OK.fbVrR/bpIqNJ5ianF.CE5elHaaO4EbggVDjb8P19RukzXSM3e"), "true");
  t.eqStr("$2b$ \\xff\\xff\\xa3 is $2y$'s digest", verifyOf(fromHex("ffffa3"), "$2b$05$/OK.fbVrR/bpIqNJ5ianF.CE5elHaaO4EbggVDjb8P19RukzXSM3e"), "true");
  t.eqStr("$2a$ \\xff\\xff\\xa3 takes the countermeasure", verifyOf(fromHex("ffffa3"), "$2a$05$/OK.fbVrR/bpIqNJ5ianF.nqd1wy.pTMdcvrRWxyiGL2eMz.2a85."), "true");
  t.eqStr("and is not the $2y$ digest under $2a$", verifyOf(fromHex("ffffa3"), "$2a$05$/OK.fbVrR/bpIqNJ5ianF.CE5elHaaO4EbggVDjb8P19RukzXSM3e"), "false");
  t.eqStr("$2y$ \\xa3", verifyOf(fromHex("a3"), "$2y$05$/OK.fbVrR/bpIqNJ5ianF.Sa7shbm4.OzKpvFnX1pQLmQW96oUlCq"), "true");
  t.eqStr("$2a$ \\xa3 (one 8-bit byte: no countermeasure needed)", verifyOf(fromHex("a3"), "$2a$05$/OK.fbVrR/bpIqNJ5ianF.Sa7shbm4.OzKpvFnX1pQLmQW96oUlCq"), "true");
  t.eqStr("$2b$ \\xa3", verifyOf(fromHex("a3"), "$2b$05$/OK.fbVrR/bpIqNJ5ianF.Sa7shbm4.OzKpvFnX1pQLmQW96oUlCq"), "true");
  t.eqStr("$2y$ \\xff\\xa334\\xff\\xff\\xff\\xa3345", verifyOf(fromHex("ffa33334ffffffa3333435"), "$2y$05$/OK.fbVrR/bpIqNJ5ianF.o./n25XVfn6oAPaUvHe.Csk4zRfsYPi"), "true");
  t.eqStr("$2a$ \\xff\\xa334\\xff\\xff\\xff\\xa3345", verifyOf(fromHex("ffa33334ffffffa3333435"), "$2a$05$/OK.fbVrR/bpIqNJ5ianF.ZC1JEJ8Z4gPfpe1JOr/oyPXTWl9EFd."), "true");
  t.eqStr("$2y$ \\xff\\xa3345", verifyOf(fromHex("ffa3333435"), "$2y$05$/OK.fbVrR/bpIqNJ5ianF.nRht2l/HRhr6zmCp9vYUvvsqynflf9e"), "true");
  t.eqStr("$2a$ \\xff\\xa3345", verifyOf(fromHex("ffa3333435"), "$2a$05$/OK.fbVrR/bpIqNJ5ianF.nRht2l/HRhr6zmCp9vYUvvsqynflf9e"), "true");
  t.eqStr("$2a$ \\xa3ab", verifyOf(fromHex("a36162"), "$2a$05$/OK.fbVrR/bpIqNJ5ianF.6IflQkJytoRVc1yuaNtHfiuq.FRlSIS"), "true");
  t.eqStr("$2y$ \\xa3ab", verifyOf(fromHex("a36162"), "$2y$05$/OK.fbVrR/bpIqNJ5ianF.6IflQkJytoRVc1yuaNtHfiuq.FRlSIS"), "true");
  t.eqStr("72 bytes of \\xaa, then more", verifyOf(joined(cycled("aa", n72), bytesOf("chars after 72 are ignored as usual")), "$2a$05$/OK.fbVrR/bpIqNJ5ianF.swQOIzjOiJ9GHEPuhEkvqrUyvWhEMx6"), "true");
  t.eqStr("\\xaa\\x55 36 times", verifyOf(cycled("aa55", n36), "$2a$05$/OK.fbVrR/bpIqNJ5ianF.R9xrDjiycxMbQE2bp.vgqlYpW5wx2yy"), "true");
  t.eqStr("\\x55\\xaa\\xff 24 times", verifyOf(cycled("55aaff", n24), "$2a$05$/OK.fbVrR/bpIqNJ5ianF.9tQZzcJfm3uj2NvJ/n5xkhpqLrMpWCe"), "true");
  t.eqStr("the empty password", verifyOf(empty, "$2a$05$CCCCCCCCCCCCCCCCCCCCC.7uG0VCzI2bS7j6ymqJi9CdcdxiRTWNy"), "true");

  // --- $2x$, the buggy sign-extending hashes, are refused ------------------
  const not2x: string = "Err: bcrypt: not a $2a$, $2b$ or $2y$ hash";
  t.eqStr("$2x$ \\xa3 is refused", verifyOf(fromHex("a3"), "$2x$05$/OK.fbVrR/bpIqNJ5ianF.CE5elHaaO4EbggVDjb8P19RukzXSM3e"), not2x);
  t.eqStr("$2x$ \\xd1\\x91 is refused", verifyOf(fromHex("d191"), "$2x$05$6bNw2HLQYeqHYyBfLMsv/OiwqTymGIGzFsA4hOTWebfehXHNprcAS"), not2x);

  // --- bcryptHash: $2b$, checked against libxcrypt ---------------------------
  t.eqStr("hash U*U at cost 4", hashOf(bytesOf("U*U"), saltC, c4), "$2b$04$CCCCCCCCCCCCCCCCCCCCC.K7Qr0se1MxuggH4aP4YgB.U2Em1pGSK");
  t.eqStr("hash U* at cost 4", hashOf(bytesOf("U*"), saltC, c4), "$2b$04$CCCCCCCCCCCCCCCCCCCCC.pKnXu/siiAoR0vsTBRexGfXoWxhbF7W");
  t.eqStr("hash U*V at cost 4", hashOf(bytesOf("U*V"), saltC, c4), "$2b$04$CCCCCCCCCCCCCCCCCCCCC.ZFYR3xBreTvOAU4t4kza04XTcHoJ2TG");
  t.eqStr("hash the empty password at cost 5", hashOf(empty, saltC, c5), "$2b$05$CCCCCCCCCCCCCCCCCCCCC.7uG0VCzI2bS7j6ymqJi9CdcdxiRTWNy");
  t.eqStr("hash \\xa3", hashOf(fromHex("a3"), saltOK, c5), "$2b$05$/OK.fbVrR/bpIqNJ5ianF.Sa7shbm4.OzKpvFnX1pQLmQW96oUlCq");
  t.eqStr("hash \\xff\\xa334\\xff\\xff\\xff\\xa3345", hashOf(fromHex("ffa33334ffffffa3333435"), saltOK, c5), "$2b$05$/OK.fbVrR/bpIqNJ5ianF.o./n25XVfn6oAPaUvHe.Csk4zRfsYPi");
  t.eqStr("hash ab", hashOf(bytesOf("ab"), saltOK, c5), "$2b$05$/OK.fbVrR/bpIqNJ5ianF.5uuuMl30oS9J/6EXNbzw5Oi1TwXM30W");
  t.eqStr("ab\\0cd hashes as ab: the key ends at its first NUL", hashOf(fromHex("6162006364"), saltOK, c5), "$2b$05$/OK.fbVrR/bpIqNJ5ianF.5uuuMl30oS9J/6EXNbzw5Oi1TwXM30W");
  t.eqStr("and verifies as ab", verifyOf(fromHex("6162006364"), "$2b$05$/OK.fbVrR/bpIqNJ5ianF.5uuuMl30oS9J/6EXNbzw5Oi1TwXM30W"), "true");
  t.eqStr("hash a 72-byte password at cost 6", hashOf(digits72, saltAbc, c6), "$2b$06$abcdefghijklmnopqrstuuxkol5yPsyoUVI1gypYXOs1LB/kvo9O.");
  t.eqStr("a 73rd byte changes nothing", hashOf(joined(digits72, bytesOf("!")), saltAbc, c6), "$2b$06$abcdefghijklmnopqrstuuxkol5yPsyoUVI1gypYXOs1LB/kvo9O.");
  t.eqStr("200 x hash as 72", hashOf(cycled("78", n200), saltZero, c4), "$2b$04$......................SZFhVdUK5wGKY4lx/QrgUMHG0XsWjbi");
  t.eqStr("72 x", hashOf(cycled("78", n72), saltZero, c4), "$2b$04$......................SZFhVdUK5wGKY4lx/QrgUMHG0XsWjbi");
  t.eqStr("a hash verifies under its own password", verifyOf(bytesOf("U*U"), hashOf(bytesOf("U*U"), saltC, c4)), "true");
  t.eqStr("and not under another", verifyOf(bytesOf("U*V"), "$2b$04$CCCCCCCCCCCCCCCCCCCCC.K7Qr0se1MxuggH4aP4YgB.U2Em1pGSK"), "false");
  t.eqStr("nor under the empty password", verifyOf(empty, "$2b$04$CCCCCCCCCCCCCCCCCCCCC.K7Qr0se1MxuggH4aP4YgB.U2Em1pGSK"), "false");

  // --- the last salt character carries 2 bits; the rest are not the hash ---
  t.eqStr("the canonical last salt character verifies", verifyOf(bytesOf("U*U"), "$2b$04$CCCCCCCCCCCCCCCCCCCCCeeICtgb3Ps6TDRViMsPFh0iKmeknYgLS"), "true");
  t.eqStr("one with dropped bits set does not, as with crypt_r", verifyOf(bytesOf("U*U"), "$2b$04$CCCCCCCCCCCCCCCCCCCCCfeICtgb3Ps6TDRViMsPFh0iKmeknYgLS"), "false");

  // --- refusals ------------------------------------------------------------
  t.eqStr("cost 3 is refused", hashOf(bytesOf("U*U"), saltC, c3), "Err: bcrypt: the cost is outside 4 to 31");
  t.eqStr("cost 32 is refused", hashOf(bytesOf("U*U"), saltC, c32), "Err: bcrypt: the cost is outside 4 to 31");
  t.eqStr("a 15-byte salt is refused", hashOf(bytesOf("U*U"), cycled("00", 15), c4), "Err: bcrypt: the salt is not 16 bytes");
  t.eqStr("a 17-byte salt is refused", hashOf(bytesOf("U*U"), cycled("00", 17), c4), "Err: bcrypt: the salt is not 16 bytes");
  t.contains("a 59-character hash is refused", verifyOf(bytesOf("U*U"), "$2b$04$CCCCCCCCCCCCCCCCCCCCC.K7Qr0se1MxuggH4aP4YgB.U2Em1pGS"), "Err: bcrypt: ");
  t.contains("a 61-character hash is refused", verifyOf(bytesOf("U*U"), "$2b$04$CCCCCCCCCCCCCCCCCCCCC.K7Qr0se1MxuggH4aP4YgB.U2Em1pGSKK"), "Err: bcrypt: ");
  t.contains("the empty string is refused", verifyOf(bytesOf("U*U"), ""), "Err: bcrypt: ");
  t.eqStr("$2c$ is refused", verifyOf(bytesOf("U*U"), "$2c$04$CCCCCCCCCCCCCCCCCCCCC.K7Qr0se1MxuggH4aP4YgB.U2Em1pGSK"), not2x);
  t.eqStr("$3b$ is refused", verifyOf(bytesOf("U*U"), "$3b$04$CCCCCCCCCCCCCCCCCCCCC.K7Qr0se1MxuggH4aP4YgB.U2Em1pGSK"), not2x);
  t.eqStr("a cost that is not two digits is refused", verifyOf(bytesOf("U*U"), "$2b$0a$CCCCCCCCCCCCCCCCCCCCC.K7Qr0se1MxuggH4aP4YgB.U2Em1pGSK"), "Err: bcrypt: the cost is not two digits");
  t.eqStr("cost 03 is refused", verifyOf(bytesOf("U*U"), "$2b$03$CCCCCCCCCCCCCCCCCCCCC.K7Qr0se1MxuggH4aP4YgB.U2Em1pGSK"), "Err: bcrypt: the cost is outside 04 to 31");
  t.eqStr("cost 32 in a hash is refused", verifyOf(bytesOf("U*U"), "$2b$32$CCCCCCCCCCCCCCCCCCCCC.K7Qr0se1MxuggH4aP4YgB.U2Em1pGSK"), "Err: bcrypt: the cost is outside 04 to 31");
  t.eqStr("a salt character outside bcrypt base64 is refused", verifyOf(bytesOf("U*U"), "$2b$04$CCCCCCCCCC!CCCCCCCCCC.K7Qr0se1MxuggH4aP4YgB.U2Em1pGSK"), "Err: bcrypt: the salt is not bcrypt base64");
  t.eqStr("a digest character outside bcrypt base64 is refused", verifyOf(bytesOf("U*U"), "$2b$04$CCCCCCCCCCCCCCCCCCCCC.K7Qr0se1MxuggH4aP4YgB+U2Em1pGSK"), "Err: bcrypt: the digest is not bcrypt base64");
  return t.done();
};
