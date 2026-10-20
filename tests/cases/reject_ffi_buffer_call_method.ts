// WP40 B1.1: a call to a buffer-taking `declare function` inside a method is
// refused as a call in a plain function is.
declare function write(fd: i32, buf: readonly u8[], n: u64): i64;

class Greeter {
  greet(): i64 {
    const b: u8[] = [104, 105, 10];
    return write(1, b, 3);
  }
}

export function main(): i32 {
  const g = new Greeter();
  console.log(`${g.greet()}`);
  return 0;
}
