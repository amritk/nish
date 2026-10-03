// #385: a string is immutable, so there is nothing `secureZero` could clear in it.
export const test = (): number => {
  const secret = "hunter2";
  secureZero(secret);
  return 0;
};
