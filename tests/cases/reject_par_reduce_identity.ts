// Every block is folded from the identity, so an identity that is not one would
// be counted once per block: `+` folds from `0`, and `1` is written here.
import { parallelReduce } from "nish/threads";

export const main = (): i32 => parallelReduce([1, 2, 3], (a, b) => a + b, 1);
