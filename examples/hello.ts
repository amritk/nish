// Hello world: the program docs/INSTALL.md walks through.
//   statictsc examples/hello.ts --link build/hello && ./build/hello
// `export function main` is the process entry; its return value is the exit code.
export function main(): number {
  console.log("hello from StaticTS");
  return 0;
}
