// `--emit-header` and `--emit-napi` describe the program's own exports,
// `Meter` and its methods, and not the C binding `sys.ts` exports to the
// modules that import it.
import { Meter } from "./meter"

export const main = (): i32 => {
  console.log(new Meter(42).read())
  return 0
}
