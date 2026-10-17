// A parallel body that makes an array literal of a captured string and reads
// its length allocates only a temporary it drops before it returns: the
// literal holds the string, which is not the body's allocation, so nothing it
// made outlives the element.
import { parallelMap } from "nish/threads";

const lengths = (names: string[], xs: i32[]): i32[] =>
  parallelMap(xs, (x): i32 => {
    const parts = [names[x % names.length], "x"];
    return parts.length + x;
  });

export const main = (): i32 => {
  const names = ["a", "bb", "ccc"];
  const got = lengths(names, [1, 2, 3, 4]);
  console.log(`${got[0]} ${got[1]} ${got[2]} ${got[3]}`);
  return 0;
};
