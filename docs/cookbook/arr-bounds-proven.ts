const sum = (a: number[]): number => {
  let total = 0;
  for (let i = 0; i < a.length; i = i + 1) {
    total = total + a[i];
  }
  return total;
};

const first = (a: number[]): number => {
  if (a.length > 0) {
    return a[0];
  }
  return 0;
};
