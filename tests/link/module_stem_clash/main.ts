// Two modules called `text.ts` in one program, in different directories, so
// `outputStems` cannot name either `.ll` after its basename and has to fall
// back to the module's path relative to the entry. No other corpus program
// takes that branch — the `nish/` cases reach modules whose basenames are
// already unique — and what this one pins is that the branch answers *two*
// files rather than one.
//
// That is WP19 §A7's question, measured in §5a item 5: the fallback joins the
// entry-relative path with `_` after dropping every `.` and `..` segment, and
// dropping the climb is lossy, so two modules whose paths differ only by one
// collapse onto a single stem and the second overwrites the first. Both
// compilers do it. This case stands where the branch still distinguishes —
// `a_text` and `b_text`, neither climbing — and `expected.ir` names a line
// from each module, so a regression that collided them would drop one from the
// emitted set rather than merely misname it.
//
// Deliberately no `nish/` import: a package module's stem is reached by
// climbing out to wherever the compiler is installed, so a program that put
// one in this branch would write a different file name for every install and
// could not be compared between two of them (§5a item 5, `tests/nish-cmp.js`).
import { tagA } from "./a/text";
import { tagB } from "./b/text";

export const main = (): number => {
  write(`${tagA()}${tagB()}\n`);
  return 0;
};
