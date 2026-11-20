// WP28 C1, `string-switch`: the control flow of a string `switch`. A template
// with no substitution and a parenthesised literal are labels like a plain
// literal. Fallthrough runs into `default` and out of it into the next case,
// an empty case group runs into `default`, a `return` leaves from a case, a
// `break` in a loop inside a case leaves only that loop, and a `continue` of
// the outer loop leaves the `switch` and the pass. The subject is evaluated
// once, before the first comparison.
const subject = (s: string, calls: number[]): string => {
  calls[0] = calls[0] + 1;
  return s;
};

const label = (s: string, calls: number[]): string => {
  let out = "";
  switch (subject(s, calls)) {
    case `tpl`:
      out = "template";
      break;
    case ("par"):
      out = "paren";
      break;
    case "into":
      out = "into ";
    // falls through
    default:
      out = out + "default";
    // falls through
    case "after":
      out = out + " after";
      break;
    case "empty":
    case "group":
  }
  return out;
};

const grouped = (s: string): string => {
  switch (s) {
    case "x":
    case "y":
    default:
      return "grouped " + s;
    case "z":
      return "z";
  }
};

const loops = (s: string): number => {
  let n = 0;
  switch (s) {
    case "loop":
      for (let i = 0; i < 10; i++) {
        if (i === 3) {
          break;
        }
        n = n + 1;
      }
      n = n + 100;
      break;
    default:
      n = -1;
  }
  return n;
};

export const main = (): void => {
  const words = ["tpl", "par", "into", "after", "other", "empty", "group"];
  const calls = [0];
  for (const w of words) {
    console.log(w + ": " + label(w, calls));
  }
  console.log("calls " + `${calls[0]}`);
  console.log(grouped("x") + ", " + grouped("y") + ", " + grouped("q") + ", " + grouped("z"));
  console.log(`${loops("loop")} ${loops("no")}`);
  const seen: string[] = [];
  for (const w of ["a", "skip", "b", "stop", "c"]) {
    switch (w) {
      case "skip":
        continue;
      case "stop":
        break;
      default:
        seen.push(w);
        continue;
    }
    seen.push("!");
  }
  console.log(seen.join(""));
};
