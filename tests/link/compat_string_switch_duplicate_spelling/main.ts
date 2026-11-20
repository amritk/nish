// A label is its text once its escapes are read: `"é"` is `"é"`, and a
// surrogate-pair escape is the astral character it spells.
const accent = (s: string): i32 => {
  switch (s) {
    case "é":
      return 1;
    case "é":
      return 2;
    default:
      return 0;
  }
};

const astral = (s: string): i32 => {
  switch (s) {
    case "😀":
      return 1;
    case "😀":
      return 2;
    default:
      return 0;
  }
};

export const main = (): i32 => accent("b") + astral("b");
