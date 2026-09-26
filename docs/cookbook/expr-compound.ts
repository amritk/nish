const step = (): number => {
  let x = 10;
  x += 5;
  x *= 2;
  const a = x++;
  const b = --x;
  return a + b;
};
