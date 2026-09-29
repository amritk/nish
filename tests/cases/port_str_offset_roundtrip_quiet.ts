// WP33 NL8001, the quiet side: an offset that one string method answers and
// another on the same string takes counts in one unit from end to end, so it
// cuts at the same character whether that unit is a UTF-8 byte or a UTF-16
// one. Nothing below leaves the string's own methods, compares with anything
// but another offset, 0 or -1, or steps further past a match than the ASCII
// needle it matched, so nothing is reported.
const afterColon = (line: string): string => {
  const at = line.indexOf(":");
  if (at < 0) {
    return line;
  }
  return line.substring(at + 1);
};

const countSpaces = (text: string): i32 => {
  let spaces = 0;
  let i = 0;
  while (i < text.length) {
    if (text.charCodeAt(i) === 32) {
      spaces = spaces + 1;
    }
    i = i + 1;
  }
  return spaces;
};

const hasArrow = (text: string): boolean => text.indexOf("=>") !== -1;

const tail = (text: string, from: i32): string => text.substring(from, text.length);

export const main = (): number => {
  const line = "clé: valeur à côté";
  console.log(afterColon(line));
  console.log(countSpaces(line));
  console.log(hasArrow(line) ? "arrow" : "none");
  console.log(tail(line, line.indexOf("à")));
  if (line.length === 0) {
    return 1;
  }
  return 0;
};
