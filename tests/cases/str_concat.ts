function join(a: string, b: string): string {
  return a + b;
}

export function test(): number {
  const s = join("foo", "bar") + "!";
  console.log(s);
  return 0;
}
