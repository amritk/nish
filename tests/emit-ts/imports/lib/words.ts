// A non-entry module that imports `map` from `nish/array` under another name
// and never calls it, and slices only strings (`array-aliased.ts`).

import { map as m } from "nish/array"

/** The second and third characters of `s`. */
export const middle = (s: string): string => s.slice(1, 3)
