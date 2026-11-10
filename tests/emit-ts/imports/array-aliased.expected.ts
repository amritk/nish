// `array-unused.ts` again, with the import aliased and in a module the entry
// imports: `lib/words.ts` writes `import { map as m } from "nish/array"` and
// never calls it, so `--emit-ts` still writes `nish/array.ts` and points the
// rewritten import at it, and Node can load the program.

import { middle } from "./lib/words.ts"

export const main = (): number => {
  console.log(middle("abcdef"))
  return 0
}
