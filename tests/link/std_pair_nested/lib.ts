import { Pair } from "nish/pair";

export const span = (at: i32, width: i32, name: string): Pair<Pair<i32, i32>, string> => ({
  first: { first: at, second: at + width },
  second: name,
});
