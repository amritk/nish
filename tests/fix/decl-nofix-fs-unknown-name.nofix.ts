// `nish:fs` has no `existsSync`, so rewriting the specifier would only trade
// this error for that one: no fix.
import { existsSync } from "fs"
export const main = (): number => (existsSync("x") ? 1 : 0)
