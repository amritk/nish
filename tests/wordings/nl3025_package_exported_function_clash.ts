// NL3025: NL3024 inside a package. Both of `clash_export`'s modules export
// `twice`, which is one package-scoped symbol.
import { run } from "./nl3_clash/node_modules/clash_export/index";

export const main = (): i32 => run();
