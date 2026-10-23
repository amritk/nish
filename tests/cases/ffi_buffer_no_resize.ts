// WP40 B1.3: a foreign call does not resize an array. No array header crosses
// to C -- a `u8[]` is lent as its data pointer only -- so `read` can write the
// buffer's bytes but cannot move its length or its block. Three lowerings that
// assumed otherwise now trust what they proved before the call:
// - `addCount`: a compound store whose right-hand side calls `read` stores
//   through the slot it bounds-checked, with no second check after the call;
// - `sumCounted`: a counted loop whose body calls `read` loads `len` once,
//   before the loop, rather than once per iteration;
// - `sumEach`: a `for...of` whose body calls `read` is a counted loop.
// `drain` calls C *and* pops, so it resizes: `addDrained` keeps the re-check,
// `sumDrained` keeps the per-iteration load and `sumEachDrained` is not counted. `Refill` reads in its
// constructor, which is a call: `sumRefilled` is counted like `sumCounted`.
declare function read(fd: i32, buf: u8[], n: u64): i64;

function drain(fd: i32, buf: u8[]): i64 {
  const n = read(fd, buf, 1);
  buf.pop();
  return n;
}

class Refill {
  n: i64;
  constructor(fd: i32, buf: u8[]) {
    this.n = read(fd, buf, 1);
  }
}

export function addCount(fd: i32, i: i32): i32 {
  const buf = new Array<u8>(4);
  if (i < 0 || i >= buf.length) {
    return -1;
  }
  buf[i] += toU8(read(fd, buf, toU64(buf.length)));
  return toI32(buf[i]);
}

export function sumCounted(fd: i32): i32 {
  const buf = new Array<u8>(4);
  let s = 0;
  for (let i = 0; i < buf.length; i++) {
    read(fd, buf, 1);
    s += toI32(buf[i]);
  }
  return s;
}

export function sumEach(fd: i32): i32 {
  const buf = new Array<u8>(4);
  let s = 0;
  for (const b of buf) {
    read(fd, buf, 1);
    s += toI32(b);
  }
  return s;
}

export function sumRefilled(fd: i32): i32 {
  const buf = new Array<u8>(4);
  let s = 0;
  for (let i = 0; i < buf.length; i++) {
    const r = new Refill(fd, buf);
    s += toI32(buf[i]) + toI32(r.n);
  }
  return s;
}

export function addDrained(fd: i32): i32 {
  const buf = new Array<u8>(4);
  buf[0] += toU8(drain(fd, buf));
  return toI32(buf[0]) + buf.length;
}

export function sumDrained(fd: i32): i32 {
  const buf = new Array<u8>(4);
  let s = 0;
  for (let i = 0; i < buf.length; i++) {
    drain(fd, buf);
    s += toI32(buf[i]);
  }
  return s;
}

export function sumEachDrained(fd: i32): i32 {
  const buf = new Array<u8>(4);
  let s = 0;
  for (const b of buf) {
    drain(fd, buf);
    s += toI32(b);
  }
  return s;
}
