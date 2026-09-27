// `using` takes only a `scope()` from `nish/threads`: a scope is the one value
// whose disposal the language defines, and a `Box` has none.
class Box {
  n: i32 = 0;
}

export const main = (): i32 => {
  using b = new Box();
  return b.n;
};
