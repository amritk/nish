// There is no success value to fall back to when the success arm is void.
export const run = (r: Result<void, string>): number => {
  r.unwrapOr(0);
  return 0;
};
