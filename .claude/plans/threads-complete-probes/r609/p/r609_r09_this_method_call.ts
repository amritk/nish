import { parallelMap } from "nish/threads";
class S {
  k: i32 = 2;
  get(): i32 {
    return this.k;
  }
  run(xs: i32[]): i32[] {
    return parallelMap(xs, (x) => x * this.get());
  }
}
export const main = (): i32 => {
  console.log(`${new S().run([1, 2])[1]}`);
  return 0;
};
