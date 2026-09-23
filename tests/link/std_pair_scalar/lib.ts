import { Pair } from "nish/pair";

export const scanEscape = (at: i32, ok: boolean): Pair<i32, boolean> => ({ first: at + 2, second: ok });
