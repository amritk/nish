// NL2712: a local nothing reads is a value the program forgot to use; a name
// that starts with `_` says it is unused on purpose.
export const main = (): i32 => {
  const total: i32 = 2 + 3;
  const doubled = total * 2;
  return total;
};
