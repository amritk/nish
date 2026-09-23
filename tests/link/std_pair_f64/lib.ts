import { Pair } from "nish/pair";

export const labelled = (x: f64): Pair<string, f64> => ({ first: "half", second: x / 2 });
