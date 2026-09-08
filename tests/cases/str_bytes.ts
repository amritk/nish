// The byte methods (WP14 A2): `charCodeAt` is a bounds check and a `load i8`,
// `substring` is the JavaScript clamp plus one `amrit_str_new`.
function firstByte(s: string): number {
  return s.charCodeAt(0);
}

function head(s: string, n: number): string {
  return s.substring(0, n);
}

export function test(): number {
  const s = "hello";
  const h = head(s, 2);
  return firstByte(s) + h.length * 1000 + head(s, 99).length * 100000 + head(s, -4).length;
}
