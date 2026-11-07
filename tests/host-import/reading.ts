// The entry tests/run.js's `host-import` section reads with --emit-ts: under
// Node it calls the host module's own functions, so it prints `42 0.5` only if
// `hI32` and `hF64` ran.
import { hF64, hI32 } from "./host"

export const main = (): number => {
  console.log(`${hI32(21)} ${hF64(2)}`)
  return 0
}
