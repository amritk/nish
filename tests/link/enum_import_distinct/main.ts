// `main.ts`'s own `Kind` is not `kinds.ts`'s, however alike they are: two
// declarations are two types, so a member of one is not an argument for the
// other.
import { weight } from "./kinds";

enum Kind {
  A = 1,
  B = 2,
}

export const main = (): number => weight(Kind.B);
