// tsc's refusal the `host-import` section pins: an import object short of one of
// the host module's functions is not the `Imports` the loader declares.
import * as host from "./host"
import type { Imports } from "./main"

export const imports: Imports = { host: { hI32: host.hI32 } }
