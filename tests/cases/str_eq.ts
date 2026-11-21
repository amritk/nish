const same = (a: string, b: string): boolean => {
  return a === b;
};

const differ = (a: string, b: string): boolean => {
  return a !== b;
};

export const test = (): number => {
  console.log(same("abc", "abc"));
  console.log(same("abc", "abd"));
  console.log(differ("x", "y"));
  return 0;
};
