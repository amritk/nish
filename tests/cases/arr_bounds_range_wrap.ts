// Under `--wrapping` a sum is defined to wrap, so a range is not the value's
// and proves nothing: the two diagonal reads keep their checks, where the
// default build proves both (`arr_bounds_range`).
const diagonals = (): i32 => {
  const up = new Array<i32>(16);
  const down = new Array<i32>(16);
  let total = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      total = total + up[c + r] + down[c - r + 7];
    }
  }
  return total;
};

export const main = (): number => {
  console.log(`${diagonals()}`);
  return 0;
};
