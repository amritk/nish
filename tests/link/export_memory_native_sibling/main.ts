// #643: a helper module's `export const memory` is `@memory` in the executable,
// and only a wasm module has a linear memory of that name to collide with, so a
// native `--link` keeps it (`export_wasm_memory_sibling` is the wasm32 build).
import { memory } from "./util";

export const main = (): i32 => {
  console.log(`${memory(41)}`);
  return 0;
};
