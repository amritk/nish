// The entry is named; the module it imports is not. The import's loose
// equality is reported with its fix, and its file is left as it is.
import { same } from "./lib"

export const main = (): i32 => (same(1, 2) ? 1 : 0)
