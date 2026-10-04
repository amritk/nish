// A function's return range proves its callers' arithmetic (src/ranges.ts,
// return summaries). Every return of `clamp` is in [0, 1000], so the sum of two
// calls is a plain `add nsw`. `half` is only entered with a byte, so its `Ok`
// payload is at most 127; `orMinus` hands that payload back or returns -1, so
// adding `orMinus(half(...))` to that sum stays in range too. A summary proves
// only the operation it is read by: a local assigned a call holds no fact
// from it. tests/cases/ovf_return_unproven is the same program with each
// assumption broken.
const clamp = (x: i32): i32 => {
  if (x < 0) {
    return 0;
  }
  if (x > 1000) {
    return 1000;
  }
  return x;
};

const half = (n: i32): Result<i32, i32> => {
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

export const test = (): number => {
  let acc: i32 = 0;
  for (let i: i32 = 0; i < 300; i++) {
    acc = (clamp(acc) + clamp(i * 7) + orMinus(half(i & 0xff))) & 0xffff;
  }
  return acc;
};
