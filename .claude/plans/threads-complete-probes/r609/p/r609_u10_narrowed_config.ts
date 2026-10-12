import { parallelMap } from "nish/threads";
class Opts {
  bias: i32 = 100;
}
const apply = (xs: i32[], o: Opts | null): i32[] => {
  if (o === null) return xs;
  return parallelMap(xs, (x) => x + o.bias);
};
export const main = (): i32 => {
  const a = apply([1, 2], new Opts());
  const b = apply([1, 2], null);
  console.log(`${a[0]} ${a[1]} ${b[0]} ${b[1]}`);
  return 0;
};
