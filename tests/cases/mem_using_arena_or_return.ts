// `orReturn()` out of a `using a = arena()` block: the error is packed into the
// register `Result` before the block releases, so the function hands back a
// number and none of the block's memory. The function gets no automatic scope
// (its allocations are all a callee's), so the release on that edge is the
// block's alone, and the arena is as high after both calls as before them.
const fill = (k: i32): i32[] => {
  const xs: i32[] = [];
  for (let i = 0; i < k; i++) {
    xs.push(i);
  }
  return xs;
};

const checked = (n: i32): Result<i32, i32> => (n >= 0 ? Ok(n) : Err(n));

const propagate = (n: i32, k: i32): Result<i32, i32> => {
  using a = arena();
  const xs = fill(k);
  const v = checked(n).orReturn();
  return Ok(v + xs.length);
};

export const main = (): void => {
  const before = Arena.used();
  const ok = propagate(4, 1000).unwrapOr(-1);
  const err = propagate(-2, 1000).unwrapOr(-1);
  const after = Arena.used();
  console.log(`${ok} ${err}`);
  console.log(after === before ? "released" : "kept");
};
