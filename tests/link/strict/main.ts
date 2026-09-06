import { twice } from "./helper";

// Built with --strict-exports (see `args`): helper.ts's non-exported `add`
// gets `internal` linkage (checked by expected.ir). Exit code: 42.
export function main(): number {
  return twice(21);
}
