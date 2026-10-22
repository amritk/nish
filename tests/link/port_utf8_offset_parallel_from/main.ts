// WP33 NL8001 (#629): the count `parallelFrom` is handed is how many elements
// it makes, so an offset there makes an array of a different length under
// TypeScript.
import { parallelFrom } from "nish/threads";

export const main = (): number => {
  const word = "héllo";
  const made = parallelFrom(word.length, (i) => i * 2);
  let total = 0;
  for (const x of made) {
    total = total + x;
  }
  console.log(total);
  return 0;
};
