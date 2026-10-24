// The entry and a package each declare three C functions, and every pair
// differs in one of the facts a declaration is analysed under: whether a
// buffer is `readonly`, whether a pointer it returns may be null, and how many
// parameters it takes. Each is two prototypes for one C symbol, so each is
// refused, naming both signatures (NL3039).
import { wideFill, wideOpen, widePair } from "./node_modules/wide/index";

declare function fill(buf: readonly u8[], n: u64): i64;
declare function open_it(): CPtr;
declare function pair(a: i32, b: i32): i32;

export const main = (): i32 => {
  const bytes: u8[] = [1, 2];
  console.log(`${wideFill(bytes)} ${wideOpen()} ${widePair(1)} ${fill(bytes, 1)} ${pair(1, 2)}`);
  return 0;
};
