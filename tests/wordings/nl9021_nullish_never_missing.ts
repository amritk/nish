// Under `--compat=nullish` a `??` whose left operand can never be missing
// compiles to that operand, as Node computes it. NL9021 names the default the
// build drops, so the program can say what it means.
const f = (a: number): number => a ?? 1

export const main = (): void => {
  console.log(f(4))
}
