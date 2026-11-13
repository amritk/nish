// WP40 §2a: a program granted `process.spawn=exec:sh` covers the literal "sh"
// as a plain grant of it does (NL2594), and the program compiles.
import { run } from "pkg_shell";

export const main = (): number => run("exit 3");
