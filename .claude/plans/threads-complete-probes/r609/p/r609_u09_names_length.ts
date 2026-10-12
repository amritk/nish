import { parallelFrom } from "nish/threads";
export const main = (): i32 => {
  const names: string[] = ["ada", "grace", "linus", "ken"];
  const lens = parallelFrom(names.length, (i) => names[i].length);
  console.log(`${lens[0]} ${lens[1]} ${lens[3]}`);
  return 0;
};
