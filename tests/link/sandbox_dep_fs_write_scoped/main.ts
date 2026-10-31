// WP40 §2a, at run time: `pkg_writer` is granted `fs.write` beneath `./out`,
// and writes the path the program's first argument names. Under `--sandbox`
// (tests/run.js) a path inside the directory is written and one outside is
// refused by Landlock; with no argument it writes nothing and exits 0.
import { writeMark } from "pkg_writer";

export const main = (): i32 => {
  const args = process.argv;
  if (args.length < 2) {
    return 0;
  }
  console.log(writeMark(args[1]));
  return 0;
};
