// Without `type`, `import type T from` is a default import, refused in its turn: no fix.
import type T from "./m"
export const main = (): number => 0
