// ovf_proven_return with each assumption broken, so every sum keeps its check
// (src/ranges.ts, return summaries). `sums` and `payloads` are exported, so a
// host may call them with anything: `clampLow`'s floor is all its summary
// says, and `halfAny`'s `Ok` payload is half of any `i32`, which tripled
// passes the top. `depth` returns its own result plus one, a range that grows
// every round of the fixpoint until it is given up, so its sum is checked too.
const clampLow = (x: i32): i32 => {
  if (x < 0) {
    return 0;
  }
  return x;
};

const halfAny = (n: i32): Result<i32, i32> => {
  if (n % 2 !== 0) {
    return Err(n);
  }
  return Ok(n / 2);
};

const orMinus = (r: Result<i32, i32>): i32 => {
  if (r.isErr()) {
    return -1;
  }
  return r.value;
};

const depth = (n: i32): i32 => {
  if (n <= 0) {
    return 0;
  }
  return depth(n - 1) + 1;
};

export const sums = (x: i32, y: i32): i32 => clampLow(x) + clampLow(y);

export const payloads = (n: i32): i32 => orMinus(halfAny(n)) * 3;

export const test = (): number => sums(2, 3) + payloads(8) + depth(10) + 1;
