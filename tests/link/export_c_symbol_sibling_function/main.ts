// #618: a helper module's `export function malloc` would be the allocator the
// runtime and the C library allocate with, and crashed.
import { malloc } from "./util";

export const main = (): i32 => {
  console.log(`${malloc(4)}`);
  return 0;
};
