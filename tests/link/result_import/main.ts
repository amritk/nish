import { parseDigit } from "./lib";

export function main(): i32 {
  const first = parseDigit("4x", 0);
  if (first.isErr()) {
    console.log(first.error.reason);
    return 1;
  }
  console.log(first.value);

  const second = parseDigit("4x", 1);
  if (second.isOk()) {
    console.log(second.value);
    return 1;
  }
  console.log(`${second.error.reason} at ${second.error.offset}`);
  return 0;
}
