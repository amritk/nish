// NL3027: NL3026 inside a package. `clash_internal`'s two modules each keep a
// private `hidden`, which is one package-scoped symbol.
import { run } from "./nl3_clash/node_modules/clash_internal/index";

export const main = (): i32 => run();
