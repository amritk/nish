// A user module that happens to be named `map` and to export a `getOrInsert`:
// it does not insert, and says so.
export const getOrInsert = (m: Map<string, i32>, key: string, value: i32): i32 => {
  console.log(`user getOrInsert ${key}`);
  return value * 100;
};
