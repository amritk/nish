// A module that binds the names of the helpers its rewrites call: each
// helper is imported as `__nish_<name>` and called by that name, so the
// module's own `idx`, `pop` and `newArray` keep theirs. A store through
// `__nish_idx` is still a store (`corpus/arr_bounds_edge`).
const pop = (n: i32): i32 => n - 1;

const newArray = (n: i32): i32 => n * 2;

const at = (xs: i32[], k: i32): i32 => xs[k];

const drop = (xs: i32[]): i32 => xs.pop();

export const main = (): i32 => {
  const idx: i32 = 1;
  const xs: i32[] = [3, 4, 5];
  console.log(at(xs, xs[0] - 2));
  xs[xs.length - 1] = xs[0] + idx;
  console.log(xs[2]);
  console.log(drop(xs));
  const ys = new Array<i32>(newArray(idx));
  console.log(ys.length);
  console.log(pop(idx));
  return 0;
};
