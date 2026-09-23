// NL3023: NL3022 inside a package. `clash_class`'s two modules each declare a
// `Base` with a constructor; a package's symbols carry its prefix, so the rule
// is about one package rather than the whole program.
import { run } from "./nl3_clash/node_modules/clash_class/index";

export const main = (): i32 => run();
