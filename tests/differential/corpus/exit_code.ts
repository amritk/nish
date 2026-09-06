// process.exit with a non-zero code stops the program; output before it is kept.
function finish(code: number): number {
  console.log(`exiting with ${code}`);
  process.exit(code);
}

export function main(): number {
  let total = 0;
  for (let i = 1; i <= 10; i++) {
    total += i;
    if (total > 20) {
      console.log(`stopped at ${i}`);
      finish(total % 256);
    }
  }
  console.log("not printed");
  return 1;
}
