// Two `declare function labs` in two packages that agree once the alias is
// resolved and the parameter names are set aside: one C function, accepted
// (docs/LANGUAGE.md "Calling C"). `ffi_package_declare_clash` is the pair
// that does not agree.
import { wideAbs } from "./node_modules/wide/index";

declare function labs(n: i64): i64;

export const main = (): i32 => {
  console.log(`${wideAbs(-40)} ${labs(-2)}`);
  return 0;
};
