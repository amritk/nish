// Every declarator of a statement is a use: the third binds a second name
// for the array the second allocates, so that array is not private, and the
// store through the first name is a shared write.
import { scope } from "nish/threads";

const twice = (n: i32): i32 => {
  const k: i32 = 2,
    xs = new Array<i32>(n),
    ys = xs;
  xs[0] = k;
  return ys[0];
};

export const main = (): i32 => {
  const out: i32[] = [0];
  {
    using s = scope();
    s.spawn(twice, 4, out, 0);
  }
  return out[0];
};
