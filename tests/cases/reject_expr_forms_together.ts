// Four refused expression forms, three of them in one function. Phase 0 ends
// the module at its first refusal (`src/compilation.ts`), so the one
// diagnostic is the first in source order, the `==` — the `typeof`, the `?.`
// and the comma after it are never reached. `tests/run.js` pins the count
// through `--json`.
export const same = (a: i32, b: i32): boolean => a == b && typeof a === "number"

export const main = (): i32 => {
  const xs: i32[] = [1]
  return xs?.[0] + (1, 2)
}
