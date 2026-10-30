// `bcryptHashN` and `bcryptVerifyN` against the single path: every lane of a
// batch of two to six must be the hash `bcryptHash` makes and the answer
// `bcryptVerify` gives, byte for byte. Random passwords (0 to 80 bytes, NULs
// and 8-bit bytes included), random salts, the given lanes in random
// positions, costs 4 to 8 and two batches at 10; verify with lanes of mixed
// cost; a malformed hash in each lane position, a short one and a bad salt
// character; the refusals; and `bcryptCalibrate` answering a width from one
// to six.
import { Suite } from "nish/testing";
import { Secret, secret, wipe } from "nish:secret";
import { bcryptCalibrate, bcryptHash, bcryptHashN, bcryptVerify, bcryptVerifyN } from "nish/crypto/bcrypt";

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
 * `bcryptHashN` on the six passwords, lane k given where bit k of `lanes` is
 * set (bit 0 always is): the six results joined by spaces, a null lane as
 * `-`, or `Err: …`.
 */
const batch = (pw: u8[][], lanes: i32, salts: u8[], cost: i32): string => {
  const h0: Secret<u8[]> = secret(copy(pw[0]));
  const h1: Secret<u8[]> | null = held(pw[1], (lanes & 2) !== 0);
  const h2: Secret<u8[]> | null = held(pw[2], (lanes & 4) !== 0);
  const h3: Secret<u8[]> | null = held(pw[3], (lanes & 8) !== 0);
  const h4: Secret<u8[]> | null = held(pw[4], (lanes & 16) !== 0);
  const h5: Secret<u8[]> | null = held(pw[5], (lanes & 32) !== 0);
  const made: Result<string[], string> = bcryptHashN(h0, h1, h2, h3, h4, h5, salts, cost);
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
  if (h4 !== null) {
    wipe(h4);
  }
  if (h5 !== null) {
    wipe(h5);
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
const batchBySingle = (pw: u8[][], lanes: i32, salts: u8[], cost: i32): string => {
  const out: string[] = [];
  for (let k: i32 = 0; k < 6; k += 1) {
    out.push((lanes & (1 << k)) === 0 ? "-" : single(pw[k], saltOf(salts, k), cost));
  }
  return out.join(" ");
};

/** `bcryptVerifyN`, lanes given as in `batch`: the six answers joined, or `Err: …`. */
const verify = (pw: u8[][], lanes: i32, hashes: string[]): string => {
  const h0: Secret<u8[]> = secret(copy(pw[0]));
  const h1: Secret<u8[]> | null = held(pw[1], (lanes & 2) !== 0);
  const h2: Secret<u8[]> | null = held(pw[2], (lanes & 4) !== 0);
  const h3: Secret<u8[]> | null = held(pw[3], (lanes & 8) !== 0);
  const h4: Secret<u8[]> | null = held(pw[4], (lanes & 16) !== 0);
  const h5: Secret<u8[]> | null = held(pw[5], (lanes & 32) !== 0);
  const answer: Result<boolean[], string> = bcryptVerifyN(h0, h1, h2, h3, h4, h5, hashes);
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
  if (h4 !== null) {
    wipe(h4);
  }
  if (h5 !== null) {
    wipe(h5);
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
const verifyBySingle = (pw: u8[][], lanes: i32, hashes: string[]): string => {
  const out: string[] = [];
  for (let k: i32 = 0; k < 6; k += 1) {
    out.push((lanes & (1 << k)) === 0 ? "false" : singleVerify(pw[k], hashes[k]));
  }
  return out.join(" ");
};

/** Six random passwords. */
const sixPasswords = (state: u32[]): u8[][] => {
  const out: u8[][] = [];
  for (let k: i32 = 0; k < 6; k += 1) {
    out.push(randomPassword(state));
  }
  return out;
};

/** A random set of `width` lanes with lane 0 among them, as a mask. */
const randomLanes = (state: u32[], width: i32): i32 => {
  let lanes: i32 = 1;
  let count: i32 = 1;
  while (count < width) {
    const k: i32 = 1 + toI32(next(state) % 5);
    if ((lanes & (1 << k)) === 0) {
      lanes |= 1 << k;
      count += 1;
    }
  }
  return lanes;
};

export const main = (): i32 => {
  const t = new Suite("bcrypt width");
  const state: u32[] = [0x2545f491];

  // Every width from two to six, the given lanes in random places, costs 4
  // to 8, and the same password in two lanes now and then.
  for (let width: i32 = 2; width <= 6; width += 1) {
    for (let round: i32 = 0; round < 5; round += 1) {
      const pw: u8[][] = sixPasswords(state);
      if (round % 2 === 1) {
        pw[5] = pw[0];
      }
      const lanes: i32 = randomLanes(state, width);
      const salts: u8[] = randomBytes(state, 96);
      const cost: i32 = 4 + round;
      t.eqStr(`hashN, width ${width}, lanes ${lanes}, cost ${cost}`, batch(pw, lanes, salts, cost), batchBySingle(pw, lanes, salts, cost));
    }
  }
  // Two batches at cost 10.
  const c10: i32 = 10;
  for (let width: i32 = 3; width <= 6; width += 3) {
    const pw: u8[][] = sixPasswords(state);
    const lanes: i32 = randomLanes(state, width);
    const salts: u8[] = randomBytes(state, 96);
    t.eqStr(`hashN, width ${width}, lanes ${lanes}, cost 10`, batch(pw, lanes, salts, c10), batchBySingle(pw, lanes, salts, c10));
  }
  // One lane is `bcryptHash`'s.
  {
    const pw: u8[][] = sixPasswords(state);
    const salts: u8[] = randomBytes(state, 96);
    t.eqStr("hashN, lane 0 alone", batch(pw, 1, salts, 4), batchBySingle(pw, 1, salts, 4));
  }

  // Verify: each lane's own hash at mixed costs and all three prefixes, one
  // password wrong, every width, lanes in random places.
  const costs: i32[] = [4, 5, 4, 4, 5, 4];
  for (let width: i32 = 1; width <= 6; width += 1) {
    const rp: u8[][] = sixPasswords(state);
    const hashes: string[] = [];
    for (let k: i32 = 0; k < 6; k += 1) {
      const h: string = single(rp[k], randomBytes(state, 16), costs[(k + width) % 6]);
      hashes.push(k === 1 ? `$2y$${h.substring(4)}` : (k === 4 ? `$2a$${h.substring(4)}` : h));
    }
    const lanes: i32 = randomLanes(state, width);
    t.eqStr(`verifyN = verify, width ${width}, lanes ${lanes}`, verify(rp, lanes, hashes), verifyBySingle(rp, lanes, hashes));
    const other: u8[][] = [rp[0], rp[1], rp[2], rp[3], rp[4], randomPassword(state)];
    t.eqStr(`verifyN = verify, lane 5 wrong, width ${width}`, verify(other, 63, hashes), verifyBySingle(other, 63, hashes));
  }

  // A malformed hash in each lane position is an Err naming it, before any
  // hashing, and is not read when its lane is null.
  const pw: u8[][] = [bytesOf("U*U"), bytesOf("U*U"), bytesOf("U*U"), bytesOf("U*U"), bytesOf("U*U"), bytesOf("U*U")];
  const good: string = "$2a$05$CCCCCCCCCCCCCCCCCCCCC.E5YPO9kmyuRGyh0XouQYb4YMJKvyOeW";
  t.eqStr("verifyN: crypt_blowfish's vector in all six lanes", verify(pw, 63, [good, good, good, good, good, good]), "true true true true true true");
  for (let k: i32 = 0; k < 6; k += 1) {
    const hashes: string[] = [good, good, good, good, good, good];
    hashes[k] = `$2x$${good.substring(4)}`;
    t.eqStr(`a malformed lane ${k} is an Err naming it`, verify(pw, 63, hashes), `Err: bcrypt: lane ${k}: not a $2a$, $2b$ or $2y$ hash`);
    if (k > 0) {
      const expect: string[] = [];
      for (let j: i32 = 0; j < 6; j += 1) {
        expect.push(j === k ? "false" : "true");
      }
      t.eqStr(`and is not read when lane ${k} is null`, verify(pw, 63 & ~(1 << k), hashes), expect.join(" "));
    }
  }
  // A short hash and a bad salt character are named the same way.
  const short: string[] = [good, good, good, good, good, good];
  short[2] = good.substring(0, 59);
  t.eqStr("a short hash in lane 2 is an Err naming it", verify(pw, 63, short), "Err: bcrypt: lane 2: a hash is 60 characters");
  const badSalt: string[] = [good, good, good, good, good, good];
  badSalt[4] = `${good.substring(0, 7)}!${good.substring(8)}`;
  t.eqStr("a bad salt character in lane 4 is an Err naming it", verify(pw, 63, badSalt), "Err: bcrypt: lane 4: the salt is not bcrypt base64");

  // Refusals.
  const salts: u8[] = randomBytes(state, 96);
  t.eqStr("95 bytes of salt are refused", batch(pw, 63, range(salts, 0, 95), 4), "Err: bcrypt: the salts are not 96 bytes");
  t.eqStr("cost 3 is refused", batch(pw, 63, salts, 3), "Err: bcrypt: the cost is outside 4 to 31");
  t.eqStr("cost 32 is refused", batch(pw, 63, salts, 32), "Err: bcrypt: the cost is outside 4 to 31");
  t.eqStr("a batch is six hashes", verify(pw, 63, [good, good, good, good, good]), "Err: bcrypt: a batch is six hashes");

  // Calibrate answers a width the batch has.
  const width: i32 = bcryptCalibrate();
  t.ok("bcryptCalibrate answers 1 to 6", width >= 1 && width <= 6);
  t.ok("and again", bcryptCalibrate() >= 1);
  return t.done();
};
