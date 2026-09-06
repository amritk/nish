function squares(n: number): number[] {
  const xs: number[] = [];
  for (let i = 0; i < n; i++) {
    xs.push(i * i);
  }
  return xs;
}

function pair(): number[] {
  return [1, 2];
}
