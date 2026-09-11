// Hello world: the program docs/INSTALL.md walks through.
//   nish examples/hello.ts --link build/hello && ./build/hello
// `export const main` is the process entry; its return value is the exit code.
export const main = (): number => {
  console.log("hello from Nish");
  return 0;
};
