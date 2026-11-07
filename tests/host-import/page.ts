// The page of tests/run.js's `host-import` section, under tsc: the host module is
// the import object `load` takes, as it stands.
import * as host from "./host"
import { type Imports, load } from "./main"

const imports: Imports = { host }
export const module = load(new Uint8Array(0), imports)
