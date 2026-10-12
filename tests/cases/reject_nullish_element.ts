// `xs[i] ?? d` is TypeScript's default past the end of an array: Node reads
// `undefined` there and answers `d`, while the bounds check panics, so the two
// targets would disagree. Test the index, or read the element first.
export const main = (): i32 => {
  const names = new Array<string | null>(2);
  names[0] = "a";
  return (names[2] ?? "none").length;
};
