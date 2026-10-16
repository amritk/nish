// #618 refuses a function of the program's own package whose symbol is its
// name and names a C library function. What it leaves alone is here, and runs:
// a method of an exported class, imported from `file.ts`, whose symbol has
// its class in front (`@File.read`); a private `write`, which is `internal`
// and spelled `@write$`, so that neither the link nor LLVM takes it for the C
// one; and a module constant called `stdout`, which is folded where it is read
// and has no symbol at all.
import { File } from "./file";

const write = (n: i32): i32 => n * 2;

const stdout: i32 = 10;

export const main = (): i32 => {
  const f = new File();
  console.log(`${write(f.read(1))} ${stdout}`);
  return 0;
};
