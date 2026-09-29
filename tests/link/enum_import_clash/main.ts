// A module that imports `Kind` may not declare a `Kind` of its own: one
// declaration namespace, whichever came first.
import { Kind } from "./kinds";

enum Kind {
  C = 3,
}

export const main = (): number => 0;
