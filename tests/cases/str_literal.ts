const greeting = (): string => {
  return "hello, world";
};

export const test = (): number => {
  console.log(greeting());
  return 0;
};
