// WP40 B1.1: a call to a buffer-taking `declare function` inside a constructor
// reached by `new` is refused as a call in a plain function is.
declare function write(fd: i32, buf: readonly u8[], n: u64): i64;

class Greeter {
  written: i64;
  constructor() {
    const b: u8[] = [104, 105, 10];
    this.written = write(1, b, 3);
  }
}

export function main(): i32 {
  const g = new Greeter();
  console.log(`${g.written}`);
  return 0;
}
