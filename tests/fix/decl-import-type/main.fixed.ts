// `import type { ... }` (NL2243): the `type` goes, and the names are imported as any other.
import { Point } from "./m"
export const main = (): number => {
  const p: Point = { x: 1, y: 2 }
  return p.x + p.y - 3
}
