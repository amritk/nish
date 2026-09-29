// Four refused declaration forms. Phase 0 ends the module at its first
// refusal (`src/compilation.ts`), so the one diagnostic is the first in
// source order, the `async` function — the generator, the namespace and the
// generic alias after it are never reached. `tests/run.js` pins the count
// through `--json`.
export async function load(): i32 {
  return 1
}

function* numbers(): i32 {
  return 1
}

namespace Shapes {
  export const sides = 4
}

type Pair<T> = T[]

export const main = (): i32 => 0
