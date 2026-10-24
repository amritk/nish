// Written by `nish --emit-ts`: runs the program's `main` under Node.
import "nish/runtime/node"
import { exit } from "nish/runtime"
import { main } from "./mathcore.ts"

const code = main()
exit(typeof code === "number" ? code : 0)
