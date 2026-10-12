import { parallelMap } from "nish/threads";
export const main = (): i32 => {
  const price = new Map<string, i32>();
  price.set("apple", 3);
  price.set("pear", 5);
  const items: string[] = ["apple", "pear", "apple"];
  const ids: i32[] = [0, 1, 2];
  const costs = parallelMap(ids, (i) => price.get(items[i]) ?? 0);
  console.log(`${costs[0]} ${costs[1]} ${costs[2]}`);
  return 0;
};
