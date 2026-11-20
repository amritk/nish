// limits.ts was written for wasm32 (ILP32), where a C `long` is an i32; a
// native build is LP64, where it is an i64, so the build refuses the module
// rather than call limit_of with the wrong width (WP66 D3).
import { LIMIT } from "./limits"

export const main = (): i32 => {
  return LIMIT
};
