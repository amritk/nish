// NL2142: `new Array(n)` has no element type to lay out, and the message shows the spelling that does.
export const main = (): i32 => {
  const xs = new Array(3);
  return 0;
};
