const passthrough = (s: string): string => {
  return s;
};

const wrapped = (s: string): string => {
  return `${s}`;
};

const printed = (s: string): string => {
  console.log(s);
  return "done";
};

export const test = (): number => {
  console.log(wrapped(passthrough("pass")));
  console.log(printed("printed"));
  return 0;
};
