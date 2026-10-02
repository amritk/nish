// `doubles(n)` with n = 2^61 asked for n * 8 bytes, which wrapped to 0:
// the header said 2^61 elements over an empty block, so every bounds check
// passed and `a[i]` wrote wherever `i` pointed. The length is now refused.
// docs/security/codegen.md, finding CG-1.
import { doubles } from "./lib";

export const main = (): number => {
  const n: i64 = toI64(parseInt("1")) << toI64(61);
  console.log("before");
  const a: f64[] = doubles(n);
  a[parseInt("200000000")] = 1.5;
  console.log("after");
  return 0;
};
