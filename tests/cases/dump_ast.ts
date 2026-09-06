function scale(p: number, k: number): number {
  let total = 0;
  for (let i = 0; i < k; i++) {
    total += p;
  }
  return total;
}

export function greet(name: string): string {
  return "hi " + name;
}
