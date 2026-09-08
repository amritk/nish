function len(s: string): number {
  return s.length;
}

export function test(): number {
  return len("hello") + "".length;
}
