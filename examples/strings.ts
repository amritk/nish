function identity(s: string): string {
  return s;
}

function pick(flag: boolean, a: string, b: string): string {
  return identity(a);
}

function len2(s: string): number {
  return 2;
}
