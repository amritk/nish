// `panic(message)` keeps the message that `throw` discards: stderr, then
// exit 1. The runner compares the status and both streams.
function checked(n: number): number {
  if (n < 0) {
    panic(`internal: negative count ${n}`);
  }
  return n * 2;
}

export function main(): number {
  console.log(`${checked(4)}`);
  console.log(`${checked(-1)}`);
  return 0;
}
