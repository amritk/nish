// The dependency is named on the command line too, and still not rewritten:
// it belongs to whoever installed it. The runner copies `node-modules/` to
// `node_modules/`, which git would otherwise ignore here.
import { same } from "dep"

export const main = (): i32 => (same(1, 2) ? 1 : 0)
