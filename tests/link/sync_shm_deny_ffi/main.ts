// `--deny ffi` refuses a program that maps a shared region: std/sync/shm.ts
// calls its C adapter in runtime/runtime-shm.c, and the error names the chain
// from main through the module.
import { createRegion } from "nish/sync/shm"

export const main = (): i32 => {
  const region = createRegion("nish-denied", 64)
  return region.isOk() ? 0 : 1
}
