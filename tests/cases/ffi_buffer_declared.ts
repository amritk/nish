// WP40 B1.1: a `declare function` takes a `u8[]` or a `readonly u8[]` in a
// run that one `u64` closes, the byte count C may touch in each buffer of the
// run. `memcpy` is one run of two buffers sharing a count, `getentropy` a
// writable buffer, and `compare` two runs with a count each. The declarations
// are accepted, and each `u8[]` parameter is declared as a plain pointer.
declare function memcpy(dst: u8[], src: readonly u8[], n: u64): CPtr;
declare function getentropy(buf: u8[], n: u64): i32;
declare function compare(a: readonly u8[], na: u64, b: readonly u8[], nb: u64): i32;
declare function abs(n: i32): i32;

export function main(): i32 {
  console.log(`${abs(-3)}`);
  return 0;
}
