import { parallelMap } from "nish/threads";
class S {
  k: i32 = 2;
  run(xs: i32[]): i32[] {
    const self = this;
    return parallelMap(xs, (x) => x * self.k);
  }
}
export const main = (): i32 => {
  console.log(`${new S().run([1, 2])[1]}`);
  return 0;
};
