// NL9012: a parallel body that allocates compiles, recycled per element, and
// the call says what every element pays for it.
import { parallelReduce } from "nish/threads";

const widest = (a: i32, b: i32): i32 => (`${a}`.length > `${b}`.length ? a : b);

export const main = (): i32 => parallelReduce([7, 42, 1000], widest, 0);
