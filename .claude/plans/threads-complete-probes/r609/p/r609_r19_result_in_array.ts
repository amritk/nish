import { parallelMap } from "nish/threads";
export const main = (): i32 => {
  const rs: Result<i32, string>[] = [Ok(3)];
  const ys = parallelMap([1, 2], (x) => x + rs.length);
  console.log(`${ys[1]}`);
  return 0;
};
