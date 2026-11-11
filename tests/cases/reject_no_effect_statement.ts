// A comparison on a line of its own computes a boolean and throws it away:
// the author meant to assign (NL2713).
export const main = (): i32 => {
  let state: i32 = 0;
  const next: i32 = 3;
  state === next;
  return state;
};
