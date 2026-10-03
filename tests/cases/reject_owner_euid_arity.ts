// #386: `geteuid` takes nothing.
export const test = (): number => {
  const me = geteuid(0);
  return 0;
};
