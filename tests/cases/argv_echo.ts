// process.argv (WP7): a string[] built once by the @main wrapper from argc/argv.
// Index 0 is the program path (C's argv[0]), so the harness only prints the
// arguments from tests/cases/argv_echo.argv, which it passes to the binary.
function count(): number {
  return process.argv.length - 1;
}

function argument(i: number): string {
  return process.argv[i];
}

export function main(): number {
  const args = process.argv;
  console.log(`${count()} argument(s)`);
  for (let i = 1; i < args.length; i++) {
    console.log(`${i}: ${argument(i)} (${args[i].length} bytes)`);
  }
  let sum = 0;
  for (const arg of args) sum += parseInt(arg);
  console.log(`sum of the numeric ones: ${sum}`);
  return args.length > 1 ? 0 : 1;
}
