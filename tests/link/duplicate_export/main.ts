import { f } from "./a";
import { g } from "./b";

// a.ts and b.ts both export `f`: one external symbol defined twice, which
// would only fail at link time. The compiler rejects it up front.
export function main(): number {
  return f() + g();
}
