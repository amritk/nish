// #643: every module of the program's own package has an empty symbol prefix,
// so a helper module's `export const memory` is `@memory` in the module, beside
// the linear memory `wasm-ld` exports under that name. A native `--link` keeps
// it (`export_memory_native_sibling`).
import { memory } from "./util";

export const main = (): i32 => {
  console.log(`${memory(41)}`);
  return 0;
};
