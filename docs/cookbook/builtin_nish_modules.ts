import { readFileSync, writeFileSync } from "nish:fs";
import { argv } from "nish:process";
import { write } from "nish:io";

export const main = (): number => {
  writeFileSync("build/cookbook/out.txt", `${argv.length}\n`);
  write(readFileSync("build/cookbook/out.txt"));
  return 0;
};
