import { scanEscape } from "./lib";

export const main = (): i32 => {
  const good = scanEscape(3, true);
  const bad = scanEscape(10, false);
  console.log(`${good.first} ${good.second} ${bad.first} ${bad.second}`);
  return 0;
};
