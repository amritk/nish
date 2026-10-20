// WP40 B1.2: a buffer's data pointer and length are loaded after the last
// argument is evaluated, so C sees the array as it is at the call. `grow`
// pushes before the call is made, and `write` sees the grown bytes. A later
// argument that cannot resize leaves the count proven (`noResize`); one that
// calls a resizing function, pops inline or constructs something that pops
// keeps the check (`resizing`, `inlinePop`, `viaNew`, exported and not run
// here; `panics_ffi_length_shrink` runs them).
declare function write(fd: i32, buf: readonly u8[], n: u64): i64;
declare function pwrite(fd: i32, buf: readonly u8[], n: u64, off: i64): i64;

function grow(b: u8[]): i32 {
  b.push(33);
  b.push(10);
  return 1;
}

function zero(): i64 {
  return 0;
}

function shrink(b: u8[]): i64 {
  b.pop();
  return 0;
}

class Popper {
  off: i64;
  constructor(b: u8[]) {
    b.pop();
    this.off = 0;
  }
}

export function noResize(): i64 {
  const buf: u8[] = [1, 2];
  return pwrite(-1, buf, toU64(buf.length), zero());
}

export function resizing(): i64 {
  const buf: u8[] = [1, 2];
  return pwrite(-1, buf, toU64(buf.length), shrink(buf));
}

export function inlinePop(): i64 {
  const buf: u8[] = [1, 2];
  return pwrite(-1, buf, toU64(buf.length), toI64(buf.pop()));
}

export function viaNew(): i64 {
  const buf: u8[] = [1, 2];
  return pwrite(-1, buf, toU64(buf.length), new Popper(buf).off);
}

export function main(): i32 {
  const b: u8[] = [104, 105];
  write(grow(b), b, 4);
  const r = noResize();
  write(1, r < 0 ? [45, 10] : [43, 10], 2);
  return 0;
}
