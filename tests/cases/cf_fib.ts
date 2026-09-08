function fibIter(n: number): number {
  let a = 0;
  let b = 1;
  for (let i = 0; i < n; i++) {
    const t = a + b;
    a = b;
    b = t;
  }
  return a;
}

function fibRec(n: number): number {
  if (n < 2) return n;
  return fibRec(n - 1) + fibRec(n - 2);
}

export function test(): number {
  return fibIter(20) + fibRec(15);
}
