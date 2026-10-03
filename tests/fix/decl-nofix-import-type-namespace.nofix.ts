// Without `type`, `import type * as m from` is a namespace import, refused in its turn: no fix.
import type * as m from "./m"
export const main = (): number => 0
