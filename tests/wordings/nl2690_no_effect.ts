// NL2690: a statement with no call, store or `await` in it computes a value
// and throws it away.
export const main = (): i32 => {
  let state: i32 = 0;
  const next: i32 = 3;
  state === next;
  return state;
};
