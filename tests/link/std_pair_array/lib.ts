import { Pair } from "nish/pair";

export const evens = (n: i32): Pair<i32[], string> => {
  const xs: i32[] = [];
  for (let i: i32 = 0; i < n; i++) {
    xs.push(i * 2);
  }
  return { first: xs, second: `${n} evens` };
};
