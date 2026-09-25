// `parallelReduce` folds each block and then combines the blocks, which is the
// left fold only for an associative operator, and `-` is not one.
import { parallelReduce } from "nish/threads";

export const main = (): i32 => parallelReduce([10, 2, 3], (a, b) => a - b, 0);
