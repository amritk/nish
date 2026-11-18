const len = (s: string): number => {
  return s.length;
};

export const test = (): number => {
  return len("hello") + "".length;
};
