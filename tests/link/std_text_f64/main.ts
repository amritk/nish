// The `std/` library under `--number-mode f64` (see `args`), which is
// the rule `docs/wp26-stdlib.md` §4 states and `std/README.md` now states
// correctly: a `std/` module spells its own widths *and* converts every value a
// builtin hands it, because `.length` and `charCodeAt` answer `number` and
// `number` is `f64` here. Before those conversions `std/text` did not compile in
// this mode at all, and `std/testing`'s two comparisons against a length lowered
// to `fcmp` on an `f64` rather than `icmp` on an `i32` — the same defect, not yet
// fatal. So the job of this case is narrow: every module compiles here and answers
// what `tests/link/std_text` and `tests/link/std_json` already pin in the default
// mode. The breadth of the behaviour stays there rather than being duplicated here.
//
// It is named for `std/text` because that is the module it was written for; it
// covers all three, because the rule is the library's and not one module's.
//
// `main` is declared `(): i32` because a `number` is not an exit code in this
// mode (LANGUAGE.md, `main`). The `toI32` calls below are the caller's half of
// the same rule: a `.length` this program reads is an `f64` here, and so is a
// bare numeric literal passed to a user function or a method, so an `i32`
// argument has to be converted at the call (LANGUAGE.md, *Numeric literals*).
import { jsonField } from "../../../std/json";
import { Suite } from "../../../std/testing";
import { contains, firstDifference, replaceAll, splitLines, splitWhitespace, trim } from "../../../std/text";

export const main = (): i32 => {
  const t = new Suite("text-f64");

  // Each call below walks bytes through a `.length` and a `charCodeAt`, the two
  // reads that were mode-dependent.
  const lines: string[] = splitLines("alpha\nbeta\n");
  if (!t.eqI32("splitLines: the terminator adds no phantom line", toI32(lines.length), toI32(2))) {
    return t.done();
  }
  t.eqStr("splitLines: the last line", lines[1], "beta");

  const words: string[] = splitWhitespace("  alpha\tbeta  ");
  if (!t.eqI32("splitWhitespace: repeated blanks add no empty elements", toI32(words.length), toI32(2))) {
    return t.done();
  }
  t.eqStr("splitWhitespace: the word after the tab", words[1], "beta");

  t.eqStr("trim: both ends go", trim(" \talpha \r\n"), "alpha");
  t.eqBool("contains: an interior occurrence", contains("alphabet", "phab"), true);
  t.eqStr("replaceAll: every occurrence, not just the first", replaceAll("a-b-c", "-", "+"), "a+b+c");

  // `firstDifference` reads two array lengths and compares them, which is the
  // read that used to make its ternary branches disagree on their type.
  t.eqI32("firstDifference: equal line lists answer -1", firstDifference(lines, splitLines("alpha\nbeta")), toI32(-1));
  t.eqI32("firstDifference: a prefix answers the shorter length", firstDifference(splitLines("alpha\n"), lines), toI32(1));

  // `std/json` walks bytes through the same two reads, and its `jsonHex4` does
  // arithmetic on them: `value * 16 + digit` is an `i32` multiply here and an
  // `f64` one without the conversions.
  const object = '{"code":"NL2231","line":2,"tab":"a\\tb","acute":"\\u00e9"}';
  const code = jsonField(object, "code");
  t.eqStr("jsonField: a string value", code === null ? "<absent>" : code, "NL2231");
  const line = jsonField(object, "line");
  t.eqI32("jsonField: a number value, through parseInt", parseInt(line === null ? "" : line), toI32(2));
  const tab = jsonField(object, "tab");
  t.eqStr("jsonField: a short escape", tab === null ? "<absent>" : tab, "a\tb");
  const acute = jsonField(object, "acute");
  // Two bytes of UTF-8 out of a `\u` escape, which is `code >> 6` and `code & 63`
  // on a value `charCodeAt` handed over: a shift and a mask are integer operators,
  // so this is the read that does not compile at all without the conversion.
  t.eqI32("jsonField: a \\u escape is UTF-8 bytes", toI32((acute === null ? "" : acute).length), toI32(2));
  const missing = jsonField(object, "column");
  t.eqBool("jsonField: an absent field answers null", missing === null, true);

  // The three assertions over text read a length or an `indexOf` of their own.
  t.contains("contains: a fragment of a captured stream", "error: cannot open x.ts", "cannot open");
  t.containsAll("containsAll: every fragment, blanks ignored", "sum=25 above=2", ["sum=25", "", "above=2"]);
  t.eqLines("eqLines: two equal line lists", splitLines("alpha\nbeta"), lines);

  // `Suite.done` reads `failures.length` on every run, so the conversion there is
  // exercised by this program passing. The other read is in `Suite.fail`, for the
  // indented detail line, and only a failing check reaches it — so a second suite
  // fails on purpose and this one checks its exit code, which leaves the
  // program's own code 0.
  const deliberate = new Suite("deliberate");
  deliberate.eqI32("a check that fails on purpose", toI32(1), toI32(2));
  t.eqI32("a failing suite answers exit code 1", deliberate.done(), toI32(1));

  return t.done();
};
