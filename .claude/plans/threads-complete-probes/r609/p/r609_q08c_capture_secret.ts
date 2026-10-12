import { parallelFrom } from "nish/threads";
import { Secret, secret } from "nish:secret";
export const main = (): i32 => {
  const key: Secret<u8[]> = secret([1, 2, 3]);
  const ys = parallelFrom(3, (i) => (key === key ? i : 0));
  console.log(`${ys[2]}`);
  return 0;
};
