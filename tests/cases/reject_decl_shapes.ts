// Every shape the declaration forms take, in one tree for
// `tests/parser-oracle.js` to hold against the `typescript` parser: stacked
// decorators on either side of `export`, on a member and on a parameter; an
// `async` generator method; dotted, string-named and declared namespaces; a
// generic alias with a default; `keyof` inside an array and a union. Phase 0
// ends the module at the first, the decorator (NL1006).
@sealed
@registry.add("c")
export class Service {
  @logged
  run(@inject x: i32): i32 {
    return x
  }

  static async *stream(): i32 {
    return 1
  }
}

export @sealed class Plain {}

namespace Geometry.Shapes.Round {
  export const sides = 0
}

module "legacy" {}

declare global {
  interface Window {}
}

type Pair<T = i32, U = T> = T[]

export const pick = (k: keyof Service, ks: (keyof Plain | null)[]): i32 => 0
