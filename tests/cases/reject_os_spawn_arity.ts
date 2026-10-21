// WP34 N12: `spawn` takes one argument, the argv; there is no options bag.
export const main = (): i32 => {
  return spawn(["/bin/true"], 0);
};
