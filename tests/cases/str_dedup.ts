const first = (): string => {
  return "same";
};

const second = (): string => {
  return "same";
};

export const test = (): number => {
  console.log(first());
  console.log(second());
  console.log("same" === second());
  return 0;
};
