// A task may wipe memory it allocated itself: the wipe writes only its
// target's bytes, and the target here is an array the task made, keeps in a
// `const` and hands to nothing that keeps it. A task wipes its own scratch; a
// helper writes the table it is handed and wipes a key copy it made, the shape
// of bcrypt's key schedule; and two tasks borrow a `Secret` the parent owns,
// each exposing it into scratch of its own that it wipes, while the parent
// wipes the `Secret` itself once the scope has joined. Nothing printed is read
// after a wipe, so the native threads and Node's one-after-another agree.
// Each array is zeroed with `fill` before it is read, as Node needs.
import { Secret, expose, secret, wipe } from "nish:secret";
import { scope } from "nish/threads";

const scratchSum = (n: i32): i32 => {
  const buf = new Array<u8>(n);
  buf.fill(0);
  for (let i: i32 = 0; i < toI32(buf.length); i++) {
    buf[i] = toU8(i + 1);
  }
  let t: i32 = 0;
  for (const b of buf) {
    t = t + toI32(b);
  }
  wipe(buf);
  return t;
};

const expand = (seed: i32, table: u32[]): void => {
  const key = new Array<u8>(4);
  key.fill(0);
  for (let i: i32 = 0; i < toI32(key.length); i++) {
    key[i] = toU8(seed + i);
  }
  for (let i: i32 = 0; i < toI32(table.length); i++) {
    table[i] = toU32(toI32(key[i % 4]) * (i + 1));
  }
  wipe(key);
};

const schedule = (seed: i32): i32 => {
  const table = new Array<u32>(8);
  table.fill(0);
  expand(seed, table);
  let t: i32 = 0;
  for (const w of table) {
    t = t + toI32(w);
  }
  wipe(table);
  return t;
};

const mixed = (key: u8[]): i32 => {
  const copy = new Array<u8>(key.length);
  copy.fill(0);
  for (let i: i32 = 0; i < toI32(copy.length); i++) {
    if (i < toI32(key.length)) {
      copy[i] = key[i];
    }
  }
  let t: i32 = 0;
  for (let i: i32 = 0; i < toI32(copy.length); i++) {
    t = t * 31 + toI32(copy[i]);
  }
  wipe(copy);
  return t;
};

const digest = (k: Secret<u8[]>): i32 => expose(k, mixed);

export const main = (): i32 => {
  const sums: i32[] = [0, 0];
  const tables: i32[] = [0, 0];
  const digests: i32[] = [0, 0];
  const pw = new Array<u8>(6);
  pw.fill(65);
  const k = secret(pw);
  {
    using s = scope();
    s.spawn(scratchSum, 10, sums, 0);
    s.spawn(scratchSum, 200, sums, 1);
    s.spawn(schedule, 1, tables, 0);
    s.spawn(schedule, 9, tables, 1);
    s.spawn(digest, k, digests, 0);
    s.spawn(digest, k, digests, 1);
  }
  wipe(k);
  console.log(`${sums[0]} ${sums[1]} ${tables[0]} ${tables[1]}`);
  console.log(`${digests[0]} ${digests[1]}`);
  return 0;
};
