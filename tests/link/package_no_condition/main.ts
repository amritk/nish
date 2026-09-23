// WP21 S3: an ordinary npm package whose `.` export is a bare file rather than
// a condition map (`docs/wp21-packages.md` §6). It declares no Nish condition
// in any spelling, so it has no Nish entry point, and the message says that is
// why. `package_not_nish` is the same answer for a map of `import` and
// `require` rows.
import { chunk } from "plainstr";

export const main = (): i32 => chunk(1);
