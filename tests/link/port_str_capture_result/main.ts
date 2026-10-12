// WP33 NL8001 through an arrow's answer (WP29): a UTF-8 byte offset a
// data-parallel arrow captures and answers with is stored in the array the
// form writes, as a pushed offset is (tests/cases/port_str_length_printed),
// whether the body is a block (in `main` and in a helper) or concise. The
// `return` is the arrow's, never `main`'s exit code. `parallelReduce` folds
// the answers into its value, which is followed on: here it is printed.
// Native prints `4 4 4 8`; TypeScript, where `l` is unit 2, `3 3 3 6`.
import { parallelFrom, parallelReduce } from "nish/threads";

const helper = (): i32 => {
  const at = "héllo".indexOf("l");
  const ys = parallelFrom(2, (i): i32 => {
    return at + i;
  });
  return ys[1];
};

export const main = (): i32 => {
  const at = "héllo".indexOf("l");
  const block = parallelFrom(2, (i): i32 => {
    return at + i;
  });
  const concise = parallelFrom(2, (k) => at + k);
  const ones: i32[] = [1, 1];
  const folded = parallelReduce(ones, (a, b) => a + b + at, 0);
  console.log(`${block[1]} ${helper()} ${concise[1]} ${folded}`);
  return 0;
};
