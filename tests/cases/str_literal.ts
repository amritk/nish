function greeting(): string {
  return "hello, world";
}

export function test(): number {
  console.log(greeting());
  return 0;
}
