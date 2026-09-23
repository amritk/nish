import { Pair } from "nish/pair";

export const step = (at: i32): Pair<i32, boolean> => ({ first: at + 1, second: at % 2 === 0 });
