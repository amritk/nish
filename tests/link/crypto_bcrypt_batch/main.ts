// `bcryptHash4` and `bcryptVerify4` against the single path: every lane of a
// batch must be the hash `bcryptHash` makes and the answer `bcryptVerify`
// gives, byte for byte. Random passwords (0 to 80 bytes, NULs and 8-bit bytes
// included), random salts and every lane count from one to four, with null
// lanes in each position; verify with lanes of mixed cost and prefix, wrong
// passwords and crypt_blowfish's vectors; and the refusals, a malformed lane
// among them.
import { Suite } from "nish/testing";
import { Secret, secret, wipe } from "nish:secret";
import { bcryptHash, bcryptHash4, bcryptVerify, bcryptVerify4 } from "nish/crypto/bcrypt";

/** xorshift32: a fixed sequence, so a failure reproduces. */
const next = (state: u32[]): u32 => {
  let x: u32 = state[0];
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  state[0] = x;
  return x;
};

/** `n` bytes from the sequence. */
const randomBytes = (state: u32[], n: i32): u8[] => {
  const out: u8[] = [];
  for (let i: i32 = 0; i < n; i += 1) {
    out.push(toU8(next(state) & 0xff));
  }
  return out;
};

/** A password of 0 to 80 bytes, a quarter of them with a NUL somewhere. */
const randomPassword = (state: u32[]): u8[] => {
  const n: i32 = toI32(next(state) % 81);
  const out: u8[] = randomBytes(state, n);
  if (n > 0 && next(state) % 4 === 0) {
    out[toI32(next(state) % toU32(n))] = 0;
  }
  return out;
};

/** The bytes of an ASCII string. */
const bytesOf = (text: string): u8[] => {
  const out: u8[] = [];
  for (let i: i32 = 0; i < toI32(text.length); i += 1) {
    out.push(toU8(text.charCodeAt(i)));
  }
  return out;
};

/** A copy of `a[from..to)`. */
const range = (a: u8[], from: i32, to: i32): u8[] => {
  const out: u8[] = [];
  for (let i: i32 = from; i < to; i += 1) {
    out.push(a[i]);
  }
  return out;
};

/** A copy of all of `a`. */
const copy = (a: u8[]): u8[] => range(a, 0, toI32(a.length));

/** The 16 bytes of `salts` at `16k`. */
const saltOf = (salts: u8[], k: i32): u8[] => range(salts, 16 * k, 16 * k + 16);

/** A held copy of `password`, or null when the lane is not `given`. */
const held = (password: u8[], given: boolean): Secret<u8[]> | null => {
  if (!given) {
    return null;
  }
  return secret(copy(password));
};

/** What `bcryptHash` makes, or `Err: …`. */
const single = (password: u8[], salt: u8[], cost: i32): string => {
  const held: Secret<u8[]> = secret(copy(password));
  const made: Result<string, string> = bcryptHash(held, salt, cost);
  wipe(held);
  return made.isErr() ? `Err: ${made.error}` : made.value;
};

/** What `bcryptVerify` answers: `true`, `false` or `Err: …`. */
const singleVerify = (password: u8[], hash: string): string => {
  const held: Secret<u8[]> = secret(copy(password));
  const answer: Result<boolean, string> = bcryptVerify(held, hash);
  wipe(held);
  if (answer.isErr()) {
    return `Err: ${answer.error}`;
  }
  return answer.value ? "true" : "false";
};

/**
 * `bcryptHash4` on the four passwords, lane k null where bit k of `nulls` is
 * set (bit 0 is never set): the four results joined by spaces, a null lane
 * as `-`, or `Err: …`.
 */
const batch = (pw: u8[][], nulls: i32, salts: u8[], cost: i32): string => {
  const h0: Secret<u8[]> = secret(copy(pw[0]));
  const h1: Secret<u8[]> | null = held(pw[1], (nulls & 2) === 0);
  const h2: Secret<u8[]> | null = held(pw[2], (nulls & 4) === 0);
  const h3: Secret<u8[]> | null = held(pw[3], (nulls & 8) === 0);
  const made: Result<string[], string> = bcryptHash4(
    h0,
    h1,
    h2,
    h3,
    salts,
    cost,
  );
  wipe(h0);
  if (h1 !== null) {
    wipe(h1);
  }
  if (h2 !== null) {
    wipe(h2);
  }
  if (h3 !== null) {
    wipe(h3);
  }
  if (made.isErr()) {
    return `Err: ${made.error}`;
  }
  const out: string[] = [];
  for (const h of made.value) {
    out.push(h === "" ? "-" : h);
  }
  return out.join(" ");
};

/** The same through `bcryptHash` lane by lane, for comparison. */
const batchBySingle = (pw: u8[][], nulls: i32, salts: u8[], cost: i32): string => {
  const out: string[] = [];
  for (let k: i32 = 0; k < 4; k += 1) {
    out.push((nulls & (1 << k)) !== 0 ? "-" : single(pw[k], saltOf(salts, k), cost));
  }
  return out.join(" ");
};

/** `bcryptVerify4`, null lanes as in `batch`: the four answers joined, or `Err: …`. */
const verify = (pw: u8[][], nulls: i32, hashes: string[]): string => {
  const h0: Secret<u8[]> = secret(copy(pw[0]));
  const h1: Secret<u8[]> | null = held(pw[1], (nulls & 2) === 0);
  const h2: Secret<u8[]> | null = held(pw[2], (nulls & 4) === 0);
  const h3: Secret<u8[]> | null = held(pw[3], (nulls & 8) === 0);
  const answer: Result<boolean[], string> = bcryptVerify4(
    h0,
    h1,
    h2,
    h3,
    hashes,
  );
  wipe(h0);
  if (h1 !== null) {
    wipe(h1);
  }
  if (h2 !== null) {
    wipe(h2);
  }
  if (h3 !== null) {
    wipe(h3);
  }
  if (answer.isErr()) {
    return `Err: ${answer.error}`;
  }
  const out: string[] = [];
  for (const ok of answer.value) {
    out.push(ok ? "true" : "false");
  }
  return out.join(" ");
};

/** The same through `bcryptVerify` lane by lane; a null lane is `false`. */
const verifyBySingle = (pw: u8[][], nulls: i32, hashes: string[]): string => {
  const out: string[] = [];
  for (let k: i32 = 0; k < 4; k += 1) {
    out.push((nulls & (1 << k)) !== 0 ? "false" : singleVerify(pw[k], hashes[k]));
  }
  return out.join(" ");
};

export const main = (): i32 => {
  const t = new Suite("bcrypt batch");
  const state: u32[] = [0x9e3779b9];
  const c4: i32 = 4;
  const c5: i32 = 5;
  const c6: i32 = 6;

  // Every null pattern with lane 0 given: 1, 2, 3 and 4 lanes in each place.
  for (let nulls: i32 = 0; nulls < 16; nulls += 2) {
    const pw: u8[][] = [randomPassword(state), randomPassword(state), randomPassword(state), randomPassword(state)];
    const salts: u8[] = randomBytes(state, 64);
    const cost: i32 = nulls % 4 === 0 ? c4 : c5;
    t.eqStr(`hash4, null lanes ${nulls}`, batch(pw, nulls, salts, cost), batchBySingle(pw, nulls, salts, cost));
  }
  // More random batches of four, the same password in two lanes among them.
  for (let round: i32 = 0; round < 6; round += 1) {
    const p: u8[] = randomPassword(state);
    const pw: u8[][] = [p, randomPassword(state), round % 2 === 0 ? p : randomPassword(state), randomPassword(state)];
    const salts: u8[] = randomBytes(state, 64);
    t.eqStr(`hash4, four lanes, round ${round}`, batch(pw, 0, salts, c4), batchBySingle(pw, 0, salts, c4));
  }

  // Verify: each lane's own hash, at mixed costs and prefixes, with one
  // wrong password, and with every null pattern.
  const pw: u8[][] = [bytesOf("U*U"), bytesOf("\xff\xff\xa3"), bytesOf("password123"), bytesOf("")];
  pw[1] = [0xff, 0xff, 0xa3];
  const vectors: string[] = [
    "$2a$05$CCCCCCCCCCCCCCCCCCCCC.E5YPO9kmyuRGyh0XouQYb4YMJKvyOeW",
    "$2a$05$/OK.fbVrR/bpIqNJ5ianF.nqd1wy.pTMdcvrRWxyiGL2eMz.2a85.",
    "$2a$04$.v8aPp6VeEEwgKR9HIRd0u1SUqZOE9HIPPdLRu7.MIjGzu.9zH4jS",
    "$2a$05$CCCCCCCCCCCCCCCCCCCCC.7uG0VCzI2bS7j6ymqJi9CdcdxiRTWNy",
  ];
  t.eqStr("verify4: crypt_blowfish's and Go's vectors, costs 5, 5, 4, 5", verify(pw, 0, vectors), "true true true true");
  for (let nulls: i32 = 0; nulls < 16; nulls += 2) {
    t.eqStr(`verify4 = verify, null lanes ${nulls}`, verify(pw, nulls, vectors), verifyBySingle(pw, nulls, vectors));
  }
  const wrong: u8[][] = [pw[0], bytesOf("password124"), pw[2], pw[3]];
  const goHash: string[] = [vectors[0], "$2a$10$ZSfEoPvlcsj2XfvsSeK25em4NZ9Jm7ntGqXuLgQfHEeZPYB8899wq", vectors[2], vectors[3]];
  t.eqStr("verify4: a wrong password is false in its lane only", verify(wrong, 0, goHash), "true false true true");
  // Random hashes at mixed costs and all three prefixes, checked lane by lane.
  // Every round mixes costs, so verify groups lanes: 3+1 with lane 0 in the
  // three, 1+3 with the three not holding lane 0, three groups with a pair of
  // lanes 1 and 3, and two pairs.
  const mixed: i32[] = [c4, c5, c4, c4, c4, c5, c5, c5, c5, c4, c6, c4, c4, c4, c5, c5];
  for (let round: i32 = 0; round < 4; round += 1) {
    const rp: u8[][] = [randomPassword(state), randomPassword(state), randomPassword(state), randomPassword(state)];
    const hashes: string[] = [];
    for (let k: i32 = 0; k < 4; k += 1) {
      const cost: i32 = mixed[4 * round + k];
      const h: string = single(rp[k], randomBytes(state, 16), cost);
      hashes.push(k === 1 ? `$2y$${h.substring(4)}` : (k === 3 ? `$2a$${h.substring(4)}` : h));
    }
    const other: u8[][] = [rp[0], rp[1], randomPassword(state), rp[3]];
    t.eqStr(`verify4 = verify, mixed costs, round ${round}`, verify(other, 0, hashes), verifyBySingle(other, 0, hashes));
  }

  // Refusals.
  const zero: u8[] = randomBytes(state, 64);
  const four: u8[][] = [pw[0], pw[0], pw[0], pw[0]];
  t.eqStr("63 bytes of salt are refused", batch(four, 0, range(zero, 0, 63), c4), "Err: bcrypt: the salts are not 64 bytes");
  t.eqStr("cost 3 is refused", batch(four, 0, zero, 3), "Err: bcrypt: the cost is outside 4 to 31");
  const bad: string[] = [vectors[0], vectors[1], "$2x$05$/OK.fbVrR/bpIqNJ5ianF.CE5elHaaO4EbggVDjb8P19RukzXSM3e", vectors[3]];
  t.eqStr("a malformed lane is an Err naming it", verify(pw, 0, bad), "Err: bcrypt: lane 2: not a $2a$, $2b$ or $2y$ hash");
  t.eqStr("and is not read when the lane is null", verify(pw, 4, bad), "true true false true");
  const short: string[] = [vectors[0].substring(0, 59), vectors[1], vectors[2], vectors[3]];
  t.eqStr("a short lane 0 is an Err naming it", verify(pw, 0, short), "Err: bcrypt: lane 0: a hash is 60 characters");
  const digest: string[] = [vectors[0], `${vectors[1].substring(0, 59)}!`, vectors[2], vectors[3]];
  t.eqStr("a bad digest character in lane 1 is an Err naming it", verify(pw, 0, digest), "Err: bcrypt: lane 1: the digest is not bcrypt base64");
  const salt: string[] = [vectors[0], vectors[1], vectors[2], `${vectors[3].substring(0, 10)}!${vectors[3].substring(11)}`];
  t.eqStr("a bad salt character in lane 3 is an Err naming it", verify(pw, 0, salt), "Err: bcrypt: lane 3: the salt is not bcrypt base64");
  const long: string[] = [vectors[0], vectors[1], vectors[2], `${vectors[3]}.`];
  t.eqStr("a long lane 3 is an Err naming it", verify(pw, 0, long), "Err: bcrypt: lane 3: a hash is 60 characters");
  t.eqStr("a batch is four hashes", verify(pw, 0, [vectors[0], vectors[1], vectors[2]]), "Err: bcrypt: a batch is four hashes");
  return t.done();
};
