// #613: an unannotated `const` takes `secret`'s inferred result, and a literal
// of strings infers `Secret<string[]>`, which `wipe` has no run of integers to
// zero.
import { secret, wipe } from "nish:secret";
export const main = (): i32 => {
  const k = secret(["key", "material"]);
  wipe(k);
  return 0;
};
