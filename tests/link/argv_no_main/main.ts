// A library program (no entry point) cannot read process.argv, even from an
// imported module: nothing would ever build the array.
import { argumentCount } from "./args";

export function twice(): number {
  return argumentCount() * 2;
}
