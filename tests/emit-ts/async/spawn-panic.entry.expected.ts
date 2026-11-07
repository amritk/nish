// Written by `nish --emit-ts`: runs the program's `main` under Node.
import "nish/runtime/node"
import { exit } from "nish/runtime"
import { settleTasks } from "nish/runtime/async.mjs"
import { main } from "./spawn-panic.ts"

const code = await main()
await settleTasks()
exit(typeof code === "number" ? code : 0)
