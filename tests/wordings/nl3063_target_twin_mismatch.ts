// NL3063: `pkg_twin`'s `nish` and `nish-wasm32` files disagree on `scale`'s
// parameter type, and a native build refuses the pair as a wasm32 one does.
import { run } from "./nl3_twin/lib";

export const main = (): i32 => run();
