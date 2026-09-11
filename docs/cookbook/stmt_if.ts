const abs = (x: number): number => {
  if (x < 0) {
    return -x;
  }
  return x;
};

const pick = (flag: boolean, a: number, b: number): number => {
  let r = 0;
  if (flag) {
    r = a;
  } else {
    r = b;
  }
  return r;
};
