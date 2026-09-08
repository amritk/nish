import { twice } from "./helper";

// Two modules each declaring their own non-exported `add`. `internal` linkage
// keeps both out of the linker's way, but the whole-program attribute fixpoint
// is keyed by symbol name, so sharing one would give each function the other's
// attributes. The name rule is therefore unconditional, and this is refused
// whatever `--strict-exports` says.
function add(a: number, b: number): number {
  return a + b;
}

export function main(): number {
  return add(twice(20), 2);
}
