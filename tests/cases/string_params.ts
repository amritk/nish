const identity = (s: string): string => {
  return s;
};

const pick = (flag: boolean, a: string, b: string): string => {
  return identity(a);
};
