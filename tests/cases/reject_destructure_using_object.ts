// `using { s } = scope()` is a syntax error, as in TypeScript: `using` binds
// only a plain name, so it never binds a pattern.
import { scope } from "nish/threads"

export const main = (): void => {
  using { s } = scope()
  console.log(1)
}
