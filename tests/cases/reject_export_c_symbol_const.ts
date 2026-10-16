// #618: an exported function of the program's own package keeps its name as its
// symbol, so `export const write` would be the definition the runtime's own
// `write(2)` binds to, and `console.log` would print nothing.
export const write = (n: i32): i32 => n + 1;

export const main = (): i32 => {
  console.log(`${write(1)}`);
  return 0;
};
