// WP33 NL8002: `slice` panics outside `[0, s.length]` where TypeScript clamps
// the bound, and counts a negative one from the end. A negative literal is
// reported with the spelling that means the same in both, and a bound the WP15
// proof cannot place inside the string with `substring`, which clamps in both.
const lastTwo = (s: string): string => s.slice(-2);

const window = (s: string, from: i32, to: i32): string => s.slice(from, to);

const past = (s: string): string => s.slice(2, 10);

export const main = (): number => {
  const word = "abcdef";
  if (word.length > 100) {
    console.log(lastTwo(word));
    console.log(past(word));
  }
  console.log(window(word, 1, 3));
  return 0;
};
