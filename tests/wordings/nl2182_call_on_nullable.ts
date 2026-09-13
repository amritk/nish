// NL2182: A method call on a nullable receiver is refused with the narrowing that would allow it.
class Point {
  x: i32 = 0;
  scale(): void {}
}

export const main = (): i32 => {
  const p: Point | null = null;
  p.scale();
  return 0;
};
