const join = (a: string, b: string): string => {
  return a + b;
};

export const test = (): number => {
  const s = join("foo", "bar") + "!";
  console.log(s);
  return 0;
};
