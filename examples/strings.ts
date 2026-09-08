export function identity(s: string): string {
  return s;
}

export function pick(flag: boolean, a: string, b: string): string {
  return identity(a);
}

export function len2(s: string): number {
  return 2;
}
