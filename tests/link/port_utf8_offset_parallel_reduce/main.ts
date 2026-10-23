// WP33 NL8001 (#629): a `parallelReduce` folds what its body answers, and the
// identity it starts from, into the value the call answers. An offset in
// either is followed on from the call, so it is reported where that value
// ends: here, printed and returned from `main` as the exit code.
import { parallelReduce } from "nish/threads";

export const main = (): number => {
  const xs: i32[] = [1, 2, 3];
  const widest = parallelReduce(xs, (acc, k) => (acc > k ? acc : k), "héllo".length);
  console.log(widest);
  return parallelReduce(xs, (acc, k) => acc + "héllo".indexOf("l") + k, 0);
};
