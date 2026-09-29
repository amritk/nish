// An imported `Result` alias is the `Result` it names: `Ok` and `Err` build
// one, and `.ok`, `.value` and `.error` read one, in a function that returns
// the `Parsed` it was handed as its own early exit.
import { digit, Message, Parsed } from "./parse";

const sum = (text: string): Parsed => {
  let total = 0;
  for (let i: i32 = 0; i < text.length; i++) {
    const d = digit(text.substring(i, i + 1));
    if (!d.ok) {
      return d;
    }
    total = total + d.value;
  }
  return Ok(total);
};

const show = (r: Parsed): Message => (r.ok ? `ok ${r.value}` : `err ${r.error}`);

export const main = (): number => {
  console.log(show(sum("1234")));
  console.log(show(sum("12x4")));
  return sum("99").ok ? 0 : 1;
};
