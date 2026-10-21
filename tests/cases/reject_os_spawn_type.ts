// WP34 N12: `spawn` takes the argument vector as a `string[]`; a command line as one string is refused.
export const main = (): i32 => {
  return spawn("sleep 30");
};
