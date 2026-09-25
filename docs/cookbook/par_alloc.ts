import { parallelMapInto } from "nish/threads";

const label = (x: i32): i32 => {
  let s = "small";
  if (x > 9) {
    s = `big ${x}`;
  }
  return s.length;
};

export const labelAll = (xs: i32[], out: i32[]): void => {
  parallelMapInto(xs, out, label);
};
