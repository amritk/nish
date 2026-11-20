// WP28 C1, `string-switch`: a `switch` over a `string` whose labels are string
// literals and module constants. The build compares the subject with each
// label in source order, as Node's `===` does, so fallthrough, `default` in
// the middle and `break` behave as they do there. Non-ASCII and empty labels
// compare by their bytes.
const GREETING: string = "hi";

const classify = (s: string): string => {
  let out = "";
  switch (s) {
    case "a":
    case "b":
      out = "letter";
      break;
    case GREETING:
      out = "greeting";
      break;
    default:
      out = "other";
      break;
    case "héllo":
      out = "accented ";
    // falls through
    case "😀":
      out = out + "wide";
      break;
    case "":
      out = "empty";
  }
  return out;
};

export const main = (): void => {
  const words: string[] = ["a", "b", "hi", "héllo", "😀", "", "hello", "zz"];
  for (const w of words) {
    console.log(`${w}: ${classify(w)}`);
  }
  // A labelled `break` leaves the loop around the `switch`.
  let seen = 0;
  outer: for (const w of words) {
    switch (w) {
      case "":
        break outer;
      default:
        seen = seen + 1;
    }
  }
  console.log(`before the empty word: ${seen}`);
};
