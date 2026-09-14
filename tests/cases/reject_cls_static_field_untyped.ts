// The cost of moving the `static` rule from the parser to the checker, written
// down as a file: a member the parser cannot finish reading never reaches the
// phase that owns the rule. stage0 names the static field; stage1 stops at the
// missing annotation and says so, which `reject_oracle.js` counts as a parser
// refusal. Both refuse the program (`docs/wp19-stage0-retirement.md` §5, R3).
export class Counter {
  static total;
}
