// Command-line arguments (WP7): process.argv is a string[] the entry wrapper
// builds once from C's argc/argv, so process.argv[0] is the program path (one
// index earlier than Node, where argv[0] is the node binary and argv[1] the
// script). It is read-only; everything else an array offers works on it.
//   nish examples/argv.ts --link build/argv && ./build/argv 3 4 five
// prints the arguments, the sum of the ones that parse as integers, and the
// count as the exit code (0 without arguments).
// smoke: argv 3 4 five
// smoke: exit 3
export const main = (): number => {
  const args = process.argv;
  console.log(`program: ${args[0].length > 0 ? "named" : "unnamed"}, ${args.length - 1} argument(s)`);
  let sum = 0;
  for (let i = 1; i < args.length; i++) {
    // Read once: a call may change an array's length, so after `Number(...)`
    // the loop condition no longer proves `args[i]` in range and a second read
    // would keep its bounds check. A local proves itself.
    const arg = args[i];
    const n = Number(arg);
    // biome-ignore lint/suspicious/noSelfCompare: NaN is the only value that is not itself; Nish has no Number.isNaN
    const parsed = n === n ? `${n}` : "not a number";
    console.log(`  ${i}: ${arg} -> ${parsed}`);
    // biome-ignore lint/correctness/useParseIntRadix: Nish parseInt is base 10 only and takes one argument
    sum += parseInt(arg);
  }
  console.log(`sum of the integers: ${sum}`);
  return args.length - 1;
};
