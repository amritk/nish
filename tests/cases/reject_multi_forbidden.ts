const f = (a: number): number => {
  return eval("a");
};

const g = (a: number): number => {
  return typeof a === "number" ? a : 0;
};

const h = (x: number): number => {
  delete x;
  return x;
};
