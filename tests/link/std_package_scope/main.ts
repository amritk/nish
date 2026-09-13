// A `nish/` module is package `nish`, not part of the program importing it.
//
// The program below declares `trimStart` and imports `std/text`, which exports
// one too. That is only legal because the two end up under different symbols
// (`@trimStart` and `@nish.trimStart`): a function name has to be unique across
// a program, because the whole-program attribute analysis is keyed by symbol.
//
// The package is decided by the specifier rather than by where the file sits,
// and this case is why. Read off the path, `std/text.ts` would be package
// `nish` when the compiler is installed (`node_modules/nish/std/`) and the
// *root* package when it is a checkout — so this program would compile against
// an installed compiler and be refused by a checkout of the same version.
import { trim, trimStart } from "nish/text";

const trimStartLocal = (text: string): string => text;

const trimEnd = (text: string): string => `${text}!`;

export const main = (): number => {
  write(`${trim("  a  ")} ${trimStart("  b")} ${trimEnd("c")} ${trimStartLocal("d")}\n`);
  return 0;
};
