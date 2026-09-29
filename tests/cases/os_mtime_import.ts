// WP34 N3: `statMtimeSync` is also an export of `nish:fs`, and an f64 in the
// default number mode.
import { statMtimeSync as mtimeOf } from "nish:fs";

export const test = (): number => {
  const m = mtimeOf("tests/cases/os_mtime.missing");
  return m !== m ? 1 : 0;
};
