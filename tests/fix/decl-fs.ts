// A bare `fs` is a package name; `nish:fs` exports the same function.
import { readFileSync } from "fs"
export const main = (): number => readFileSync("decl-fs.ts").length
