// Reading a file that does not exist prints a message to stderr and exits 1.
export function main(): number {
  console.log("start");
  const text = readFileSync("build/test/differential/does-not-exist.txt");
  console.log(text.length);
  console.log("not printed");
  return 0;
}
