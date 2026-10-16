// The helper module of `main.ts`, whose `export function` keeps its name as
// its symbol as an `export const` does.
export function malloc(n: i32): i32 {
  return n * 2;
}
