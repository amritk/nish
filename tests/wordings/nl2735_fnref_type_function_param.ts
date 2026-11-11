// NL2735: a function type that takes a function, as a reference's type. Every
// function it could name is a template, with no single body to tag.
export const main = (): i32 => {
  const fs: ((g: (x: i32) => i32) => i32)[] = [];
  return fs.length;
};
