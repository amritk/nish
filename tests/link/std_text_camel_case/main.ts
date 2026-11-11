// The snake_case → camelCase example on the guide's `nish/text` section
// (docs/guide/using-nish/standard-library.md), kept compiling and pinned here:
// natively by the link loop, and under the Node prelude by tests/run.js's
// `std_text` section.
import { asciiLower, asciiUpper, split } from "nish/text";
import { Regex, regexCompile } from "nish/regex";

const toCamel = (separators: Regex, name: string): string => {
  const words = split(asciiLower(separators.replaceAll(name, "_")), "_");
  const camel: string[] = [words[0]];
  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    camel.push(asciiUpper(word.substring(0, 1)));
    camel.push(word.substring(1));
  }
  return camel.join("");
};

export const main = (): i32 => {
  const compiled = regexCompile("[-\\s]+", "");
  if (compiled.isErr()) {
    console.log(compiled.error);
    return 1;
  }
  const separators: Regex = compiled.value;
  console.log(toCamel(separators, "user_account-ID"));
  console.log(toCamel(separators, "HTTP status-code"));
  console.log(toCamel(separators, "already__doubled_"));
  return 0;
};
