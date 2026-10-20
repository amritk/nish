// NL2352: a parallel body that stores what it allocates into an array its
// caller owns is refused, and the remedy is the serial loop in the program's names.
import { parallelMap } from "nish/threads";

export const main = (): i32 => {
  const xs: i32[] = [1, 2, 3];
  const seen: string[] = [];
  const ys = parallelMap(xs, (x: i32): i32 => {
    seen.push(`${x}`);
    return x * 2;
  });
  console.log(ys.length);
  console.log(seen.length);
  return 0;
};
