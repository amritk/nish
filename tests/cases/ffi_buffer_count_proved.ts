// WP40 B1.2: the one count the compiler proves is `toU64(x.length)` where `x`
// is the buffer argument itself, a `const` local or a parameter named alone,
// and no later argument may resize an array. `constLocal` and `param` carry
// no check in the IR. Each of the other three keeps its `ffi-length` check,
// though each count here fits: a field path, a count read through an alias of
// the buffer, and the count of another array.
declare function write(fd: i32, buf: readonly u8[], n: u64): i64;

class Holder {
  buf: u8[];
  constructor(buf: u8[]) {
    this.buf = buf;
  }
}

function constLocal(): i64 {
  const b: u8[] = [97, 10];
  return write(1, b, toU64(b.length));
}

function param(b: readonly u8[]): i64 {
  return write(1, b, toU64(b.length));
}

function field(h: Holder): i64 {
  return write(1, h.buf, toU64(h.buf.length));
}

function alias(b: u8[]): i64 {
  const other = b;
  return write(1, b, toU64(other.length));
}

function another(b: u8[], c: u8[]): i64 {
  return write(1, b, toU64(c.length));
}

export function main(): i32 {
  constLocal();
  const p: u8[] = [98, 10];
  param(p);
  field(new Holder([99, 10]));
  alias([100, 10]);
  another([101, 10], [0, 0]);
  return 0;
}
