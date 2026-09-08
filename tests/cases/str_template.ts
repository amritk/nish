function describe(n: number, ok: boolean, name: string): string {
  return `${name}: n=${n}, ok=${ok}!`;
}

export function test(): number {
  console.log(describe(42, true, "answer"));
  console.log(`${"solo"}`);
  console.log(`${1 + 2}`);
  return 0;
}
