// A `join` whose result would pass 2^31 - 1 bytes fails as an allocation
// does (`nish: out of memory`, exit 1) before anything is allocated, the way
// a concatenation past that length does (RT-2). Under `--number-mode i32` the
// result's `length` read back negative, and the bounds-check prover trusts
// `.length` to be non-negative. 32 copies of a 64 MiB separator between 33
// one-byte parts make 2^31 + 33 bytes, while the program itself holds only
// the separator. docs/security/codegen.md, CG-3.
import { doubled, joinedLength } from "./lib";

export const main = (): number => {
  const sep = doubled("x", 26);
  console.log(`sep ${sep.length}`);
  const parts: string[] = [];
  let i = 0;
  while (i < 33) {
    parts.push("a");
    i = i + 1;
  }
  console.log(`small ${joinedLength(["ab", "c"], ",")}`);
  console.log(`joined ${joinedLength(parts, sep)}`);
  return 0;
};
