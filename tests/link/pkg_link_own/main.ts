// WP66 S7: a package links its own C source and a system library.
import { add, cubeRoot } from "./lib"

export const main = (): i32 => {
  console.log(add(2, 3))
  console.log(cubeRoot(27.0) > 2.999 && cubeRoot(27.0) < 3.001)
  return 0
}
