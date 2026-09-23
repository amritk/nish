// WP15 §2: a user function called `toI32` wins over the builtin, and it may
// answer anything — this one answers one past the length. So its answer is
// not trusted as a length: the access keeps its bounds check and warns, and
// the check is what stops the last pass. Run by the performance block of
// tests/run.js, which pins the warning and the panic
// (`index out of range: 3 >= 3`), since `.out` cannot express an exit of 1.
const toI32 = (n: i32): i32 => n + 1;

export const main = (): i32 => {
  const s = "abc";
  const n: i32 = toI32(s.length);
  let i: i32 = 0;
  while (i < n) {
    console.log(s.charCodeAt(i));
    i += 1;
  }
  return 0;
};
