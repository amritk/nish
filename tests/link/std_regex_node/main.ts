// `nish/regex` with a class, a set escape or an alternation, natively and under
// the Node prelude (tests/run.js, `std_regex_node`). Such a pattern builds the
// lazy DFA, whose tables the module read as zeros: `new Array<i32>(n)`
// zero-fills natively and leaves holes under Node, so there the hash probe
// never met an empty slot and `[-\s]+` never returned (#1362).
import { regexCompile } from "nish/regex";

const show = (pattern: string, flags: string, text: string): void => {
  const compiled = regexCompile(pattern, flags);
  if (compiled.isErr()) {
    console.log(`/${pattern}/ ${compiled.error}`);
    return;
  }
  const re = compiled.value;
  console.log(
    `/${pattern}/${flags} on "${text}": test ${re.test(text)}, count ${re.count(text)}, replace "${re.replace(text, "_")}", replaceAll "${re.replaceAll(text, "_")}", findAll [${re.findAll(text).join("|")}]`
  );
};

export const main = (): i32 => {
  show("[-\\s]+", "", "a_b-c");
  show("[-\\s]+", "", "user_account-ID  two");
  show("[ab]", "", "cabbage");
  show("[ab]+", "", "cabbage");
  show("[ab]*", "", "cab");
  show("[a-c]{2,}", "", "abcxab-a-cba");
  show("[^a-z]+", "", "ab12cd--ef");
  show("\\s+", "", "one  two\tthree");
  show("\\d+|x", "", "a1x22b333");
  show("[AB]+", "i", "xaBbAy");
  show("(?:ab|cd)+", "", "abcdxcdab");
  return 0;
};
