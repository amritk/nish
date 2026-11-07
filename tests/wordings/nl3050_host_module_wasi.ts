// NL3050 under WASI: a WASI program links C, so it imports no host module.
import { twice } from "./host/plain"
export function main(): i32 {
  return twice(2)
}
