// The program of tests/run.js's package route check: `src/host.ts` is a host
// module because package.json's `nish.host` names it, with no `--host`.
import { twice } from "./src/host"

export function quad(x: f64): f64 {
  return twice(twice(x)) + 1
}
