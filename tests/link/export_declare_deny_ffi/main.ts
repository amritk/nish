// WP89 S3b: a module that imports a C binding from another calls C, so
// `--deny ffi` refuses it, and the error names the chain from main through the
// importing module to the declared function in `sys.ts`.
import { countFrom } from "./lib"

export const main = (): i32 => {
  return countFrom(7, 3) === 10 ? 0 : 1
}
