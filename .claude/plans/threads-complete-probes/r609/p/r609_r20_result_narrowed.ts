import { parallelMap } from "nish/threads";
export const main = (): i32 => {
  const r: Result<i32, string> = Ok(3);
  if (r.isOk()) {
    const v = r.value;
    const ys = parallelMap([1, 2], (x) => x + v);
    console.log(`${ys[1]}`);
  }
  return 0;
};
