// An import from `nish/array` that the program writes but never calls: the
// module emits no code, but the emitted TypeScript still names it, so
// `--emit-ts` writes `nish/array.ts` beside it and Node can load the program.
// A string's `slice` alone writes no `nish/array.ts` (`strings/offsets`).
import { slice } from "nish/runtime"

import { map } from "./nish/array.ts"

export const main = (): number => {
  console.log(slice("abcdef", 1, 3))
  return 0
}
