// An import from `nish/array` the program writes is dumped, and so is
// `std/array.ts`, even when nothing instantiates it. The imports the checker
// adds for a string's `slice` are not (`dump_shared_write_panic`).
import { map } from "nish/array"

export const head = (s: string): string => s.slice(0, 2)
