// WP29 P2: `using` is a declaration only when a binding name follows it on the
// same line; everywhere else it is an ordinary identifier. `[Symbol.dispose]`
// is the one computed member name the grammar reads.
class Handle {
  n: i32 = 0;
  [Symbol.dispose](): void {}
}

const using = (x: i32): i32 => x;

export const main = (): number => {
  using h = new Handle();
  const a = using(1);
  let b = using
  (2);
  {
    using inner = new Handle(), other = new Handle();
  }
  return a + b;
};
