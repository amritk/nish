import { evens } from "./lib";

export const main = (): i32 => {
  const p = evens(4);
  console.log(`${p.second}: ${p.first[3]}`);
  return 0;
};
