// `pbkdf2HmacSha256` (`nish/crypto/hmac`) against the published answers. The
// two 64-byte keys are RFC 7914 §11's PBKDF2-HMAC-SHA256 vectors; the 20-byte
// one is the first of them cut short, which RFC 8018 §5.2 step 4 makes a
// prefix. The long password and the empty salt sit on no RFC vector and were
// checked against Python's `hashlib.pbkdf2_hmac`, the four-block key also
// against OpenSSL. The null checks pin that bad input answers an error and
// never panics.
import { Suite } from "nish/testing";
import { pbkdf2HmacSha256 } from "nish/crypto/hmac";
import { Secret, expose, secret, wipe } from "nish:secret";

const HEX_DIGITS: string = "0123456789abcdef";

/** `bytes` as lowercase hex, two digits a byte, the way RFC 7914 prints them. */
const hexOf = (bytes: u8[]): string => {
  const parts: string[] = [];
  for (const b of bytes) {
    const v: i32 = toI32(b);
    const hi: i32 = v >> 4;
    const lo: i32 = v & 15;
    parts.push(HEX_DIGITS.substring(hi, hi + 1));
    parts.push(HEX_DIGITS.substring(lo, lo + 1));
  }
  return parts.join("");
};

/** The bytes of an ASCII string, for the RFC's passwords and salts. */
const bytesOf = (text: string): u8[] => {
  const out: u8[] = [];
  const n: i32 = toI32(text.length);
  for (let i: i32 = 0; i < n; i += 1) {
    out.push(toU8(text.charCodeAt(i)));
  }
  return out;
};

/** The derived key in hex, or "null" when there is none. */
const derive = (password: string, salt: string, iterations: i32, length: i32): string => {
  const held: Secret<u8[]> = secret(bytesOf(password));
  const dk: Secret<u8[]> | null = pbkdf2HmacSha256(held, bytesOf(salt), iterations, length);
  wipe(held);
  if (dk === null) {
    return "null";
  }
  const hex: string = expose(dk, hexOf);
  wipe(dk);
  return hex;
};

/**
 * The bytes `Arena.used()` grows by across one derivation of `iterations`
 * rounds: the derived key and the call's own allocations that outlive it.
 */
const keptBy = (iterations: i32): i64 => {
  const held: Secret<u8[]> = secret(bytesOf("passwd"));
  const salt: u8[] = bytesOf("salt");
  const before: i64 = Arena.used();
  const dk: Secret<u8[]> | null = pbkdf2HmacSha256(held, salt, iterations, toI32(32));
  const kept: i64 = Arena.used() - before;
  wipe(held);
  if (dk !== null) {
    wipe(dk);
  }
  return kept;
};

/** Runs every check, prints one line each, and answers the exit code. */
export const pbkdf2Checks = (): i32 => {
  const t = new Suite("pbkdf2");
  const one: i32 = 1;
  const zero: i32 = 0;
  const minus: i32 = -1;
  const short: i32 = 20;
  const full: i32 = 64;

  t.eqStr(
    "RFC 7914 §11: P=\"passwd\", S=\"salt\", c=1, dkLen=64",
    derive("passwd", "salt", one, full),
    "55ac046e56e3089fec1691c22544b605f94185216dde0465e68b9d57c20dacbc49ca9cccf179b645991664b39d77ef317c71b845b1e30bd509112041d3a19783"
  );
  t.eqStr(
    "RFC 7914 §11: P=\"Password\", S=\"NaCl\", c=80000, dkLen=64",
    derive("Password", "NaCl", 80000, full),
    "4ddcd8f60b98be21830cee5ef22701f9641a4418d04c0414aeff08876b34ab56a1d425a1225833549adb841b51c9b3176a272bdebba1d078478f62b397f33c8d"
  );
  t.eqStr(
    "dkLen=20 is the first 20 bytes of the c=1 vector",
    derive("passwd", "salt", one, short),
    "55ac046e56e3089fec1691c22544b605f9418521"
  );

  // 100 bytes is longer than SHA-256's block, so the password is hashed
  // first (RFC 2104 §2); 33 bytes is one byte into a second block.
  const long: string[] = [];
  for (let i: i32 = 0; i < 100; i += 1) {
    long.push("p");
  }
  t.eqStr(
    "a 100-byte password, c=2, dkLen=33",
    derive(long.join(""), "salt", 2, 33),
    "7fb39a0c2291de62231e50ab5f6805b83bab97446d73dccf38114fb21c05542759"
  );
  t.eqStr(
    "an empty salt, c=3, dkLen=32",
    derive("pw", "", 3, 32),
    "72508a5bfcf14df34dcfcfd2a123ace17fbca71efd70a2a72a82275d270fbf67"
  );
  // 100 bytes is four blocks (the last cut to 4 bytes), so INT_32_BE(i)
  // runs to 4. Checked against Python's `hashlib.pbkdf2_hmac` and OpenSSL's
  // `openssl kdf ... PBKDF2`, which agree.
  t.eqStr(
    "dkLen=100 runs to block 4, c=2",
    derive("passwd", "salt", 2, 100),
    "2d412f896e76685e30df569f0a740634e31f031f749d607d9e44210bffb91a6ab670f500c78862001959f7d7b9f96afb3605700298acb14427e0239463c66f20bb7478be71d96f1b6e33189869c4347dfc250fde2b2a17437d19db2893c6d26457136493"
  );

  t.eqStr("0 iterations answers null", derive("passwd", "salt", zero, full), "null");
  t.eqStr("-1 iterations answers null", derive("passwd", "salt", minus, full), "null");
  t.eqStr("dkLen=0 answers null", derive("passwd", "salt", one, zero), "null");
  t.eqStr("dkLen=-1 answers null", derive("passwd", "salt", one, minus), "null");

  // Each round's digests die in the call that made them, so a thousand
  // rounds keep no more than one does.
  t.eqI64("c=1000 keeps no more arena than c=1", keptBy(toI32(1000)), keptBy(one));

  return t.done();
};
