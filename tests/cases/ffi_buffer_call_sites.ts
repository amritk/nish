// WP40 B1.2: a call to a buffer-taking `declare function` lowers wherever it
// is written: in a plain function, in a constructor reached by `new`, in a
// method, and through a compile-time function parameter bound to it: four of
// the five places B1.1 refused (NL2554). The fifth, an arrow a scope spawns,
// stays refused for another reason (`reject_ffi_buffer_call_spawn`).
// Every line goes through `write`, so none interleaves with `console.log`'s
// buffer.
declare function write(fd: i32, buf: readonly u8[], n: u64): i64;

class Greeter {
  written: i64;
  constructor() {
    const b: u8[] = [99, 10];
    this.written = write(1, b, toU64(b.length));
  }
  greet(): i64 {
    const b: u8[] = [109, 10];
    return write(1, b, toU64(b.length));
  }
}

function via(f: (fd: i32, buf: readonly u8[], n: u64) => i64): i64 {
  const b: u8[] = [112, 10];
  return f(1, b, 2);
}

export function main(): i32 {
  const b: u8[] = [102, 10];
  write(1, b, 2);
  const g = new Greeter();
  g.greet();
  via(write);
  return 0;
}
