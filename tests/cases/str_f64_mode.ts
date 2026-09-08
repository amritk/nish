function len(s: string): number {
  return s.length;
}

export function test(): number {
  console.log(`${1.5} and ${len("abc")}`);
  console.log(0.25);
  return len("hello");
}
