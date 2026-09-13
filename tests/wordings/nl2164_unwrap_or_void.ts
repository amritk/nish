// NL2164: `unwrapOr` needs a success value to fall back to, and the message names the branch that works instead.
const work = (): Result<void, string> => Ok();

export const main = (): i32 => {
  const r = work();
  const v = r.unwrapOr(0);
  return 0;
};
