// WP40 §2a, at run time: `pkg_reader` is granted `fs.read` beneath `./data`,
// and reads the path the program's first argument names. Under `--sandbox`
// (tests/run.js) a path inside the directory is read and one outside is
// refused by Landlock; with no argument it reads nothing and exits 0.
import { readLength } from "pkg_reader";

export const main = (): i32 => {
  const args = process.argv;
  if (args.length < 2) {
    return 0;
  }
  console.log(readLength(args[1]));
  return 0;
};
