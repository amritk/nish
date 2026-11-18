// #618: `export function` is the other spelling of an exported function, and it
// keeps its name as its symbol too: an exported `free` would be the allocator
// the runtime and the C library free their memory with.
export function free(n: i32): i32 {
  return n - 1;
}

export const main = (): i32 => free(1);
