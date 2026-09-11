// process.argv read from an imported module (WP7): the entry's @main wrapper
// still builds the array (nish_argv_init) because the Compilation propagates
// the use program-wide, and args.ts declares @nish_argv as an external global.
import { argumentCount, firstArgumentIsSet } from "./args";

export function main(): number {
  console.log(`arguments: ${argumentCount()}`);
  console.log(firstArgumentIsSet() ? "argv[0] set" : "argv[0] missing");
  return argumentCount() + 1;
}
