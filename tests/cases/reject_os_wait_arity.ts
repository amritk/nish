// WP34 N12: `waitPid` takes a pid and a flag word; the flags are not optional.
export const main = (): i32 => {
  return waitPid(-1)[0];
};
