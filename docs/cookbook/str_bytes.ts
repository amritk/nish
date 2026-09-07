function firstByte(s: string): number {
  return s.charCodeAt(0);
}

function head(s: string, n: number): string {
  return s.substring(0, n);
}

function has(s: string, sub: string): boolean {
  return s.startsWith(sub) || s.endsWith(sub);
}
