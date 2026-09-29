// Two refused statement forms in one construct, and a third after them. Phase 0
// ends the module at its first refusal (`src/compilation.ts`: a Phase 0
// refusal stops the compilation there), so the one diagnostic is the first in
// source order, `for...in` — the `var` in its head and the labelled loop
// below are never reached. `tests/run.js` pins the count through `--json`.
export const main = (): i32 => {
  const xs: i32[] = [1];
  for (var k in xs) {
  }
  outer: for (const j in xs) {
  }
  return 0;
};
