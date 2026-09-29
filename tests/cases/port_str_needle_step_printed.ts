// WP33 NL8001: a step past an ASCII match is not a fact from outside, but the
// stepped offset still is one wherever it is printed or stored: on "café: bar"
// `line.indexOf(":") + 1` is 6 here and 5 under Node. The same step handed to
// a string method on the same line is quiet, and a step past the end of the
// needle (`+ 2` on a one-byte `":"`) is a count written into the program, which
// is reported at the step itself.
const printPos = (line: string): void => {
  console.log(line.indexOf(":") + 1);
};

const storePos = (line: string, into: i32[]): void => {
  const at = line.indexOf(":") + 1;
  into.push(at);
};

const afterColon = (line: string): string => line.substring(line.indexOf(":") + 1, line.length);

const afterGap = (line: string): string => line.substring(line.indexOf(":") + 2, line.length);

export const main = (): number => {
  const line = "café: bar";
  printPos(line);
  const positions: i32[] = [];
  storePos(line, positions);
  console.log(positions[0]);
  console.log(afterColon(line));
  console.log(afterGap(line));
  return 0;
};
