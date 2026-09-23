import { labelled } from "./lib";

export const main = (): i32 => {
  const p = labelled(5);
  console.log(`${p.first} ${p.second}`);
  return 0;
};
