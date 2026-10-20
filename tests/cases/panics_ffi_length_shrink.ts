// WP40 B1.2: the length is loaded after every argument is evaluated, so a
// later argument that shrinks the buffer is seen. `toU64(buf.length)` reads 4,
// `shrink` and the `Popper` constructor pop a byte, and the check compares 4
// against 3. The count is not credited as proven, because a later argument
// calls something that may resize the array.
declare function pwrite(fd: i32, buf: readonly u8[], n: u64, off: i64): i64;

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

export function viaCall(): i32 {
  const buf: u8[] = [1, 2, 3, 4];
  return toI32(pwrite(-1, buf, toU64(buf.length), shrink(buf)));
}

export function viaNew(): i32 {
  const buf: u8[] = [1, 2, 3, 4];
  return toI32(pwrite(-1, buf, toU64(buf.length), new Popper(buf).off));
}
